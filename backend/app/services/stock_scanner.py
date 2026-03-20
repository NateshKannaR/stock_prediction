from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.watchlist import INTRADAY_UNIVERSE, SECTOR_MAP
from app.services.indicators import add_technical_indicators
from app.services.market_data import MarketDataService
from app.services.news_sentiment import COMPANY_NAMES, COMPANY_SEARCH_TERMS, NewsSentimentService
from app.services.predictor import PredictionService


class StockScore:
    def __init__(
        self,
        symbol: str,
        volatility: float,
        volume_surge: float,
        trend_strength: float,
        ml_confidence: float,
        ml_signal: str,
        liquidity: float,
        momentum: float,
        sector: str,
        sentiment_score: float = 0.0,
        sentiment_label: str = "neutral",
    ):
        self.symbol = symbol
        self.volatility = volatility
        self.volume_surge = volume_surge
        self.trend_strength = trend_strength
        self.ml_confidence = ml_confidence
        self.ml_signal = ml_signal
        self.liquidity = liquidity
        self.momentum = momentum
        self.sector = sector
        self.sentiment_score = sentiment_score
        self.sentiment_label = sentiment_label
        self.intraday_score = self._calculate_score()

    def _calculate_score(self) -> float:
        # Weighted composite score for intraday trading
        score = (
            self.volatility * 0.20 +        # Higher volatility = more profit potential
            self.volume_surge * 0.20 +      # Volume confirms moves
            self.trend_strength * 0.15 +    # Strong trends easier to trade
            self.ml_confidence * 0.20 +     # Model confidence
            (1 / max(self.liquidity, 0.01)) * 0.10 +  # Tight spreads reduce slippage
            abs(self.sentiment_score) * 0.15  # News sentiment impact
        )
        # Boost for strong BUY/SELL signals
        if self.ml_signal in ["BUY", "SELL"]:
            score *= 1.2
        # Boost for positive sentiment on BUY, negative on SELL
        if self.ml_signal == "BUY" and self.sentiment_score > 0.3:
            score *= 1.1
        elif self.ml_signal == "SELL" and self.sentiment_score < -0.3:
            score *= 1.1
        return round(score, 4)

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "intraday_score": self.intraday_score,
            "volatility": round(self.volatility, 4),
            "volume_surge": round(self.volume_surge, 2),
            "trend_strength": round(self.trend_strength, 2),
            "ml_confidence": round(self.ml_confidence, 4),
            "ml_signal": self.ml_signal,
            "liquidity": round(self.liquidity, 4),
            "momentum": round(self.momentum, 4),
            "sector": self.sector,
            "sentiment_score": round(self.sentiment_score, 3),
            "sentiment_label": self.sentiment_label,
        }


class StockScannerService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.market_service = MarketDataService(db)
        self.predictor = PredictionService()
        self.sentiment_service = NewsSentimentService(db)

    async def scan_universe(
        self,
        interval: str = "5minute",
        min_candles: int = 100,
        top_n: int = 5,
        include_sentiment: bool = True,
    ) -> list[dict[str, Any]]:
        """Scan all stocks in universe and return top N ranked by intraday score."""
        scores = []
        
        for symbol in INTRADAY_UNIVERSE:
            try:
                score = await self._score_stock(symbol, interval, min_candles, include_sentiment)
                if score:
                    scores.append(score)
            except Exception:
                continue

        # Rank by composite score
        ranked = sorted(scores, key=lambda x: x.intraday_score, reverse=True)
        
        # Persist to database
        await self._persist_scores(ranked)
        
        return [s.to_dict() for s in ranked[:top_n]]

    async def _score_stock(
        self,
        symbol: str,
        interval: str,
        min_candles: int,
        include_sentiment: bool = True,
    ) -> StockScore | None:
        """Calculate intraday score for a single stock."""
        candles = await self.market_service.recent_candles(symbol, interval, limit=120)
        
        if len(candles) < min_candles:
            return None

        # Convert to DataFrame
        df = pd.DataFrame([
            {
                "timestamp": c.timestamp,
                "open": float(c.open),
                "high": float(c.high),
                "low": float(c.low),
                "close": float(c.close),
                "volume": c.volume,
            }
            for c in candles
        ])

        # Add technical indicators
        df = add_technical_indicators(df)
        if df.empty:
            return None

        # Calculate metrics
        volatility = self._calculate_atr(df)
        volume_surge = self._calculate_volume_surge(df)
        trend_strength = self._calculate_adx(df)
        liquidity = self._calculate_liquidity(df)
        momentum = self._calculate_momentum(df)

        # Get ML prediction
        candle_rows = [
            [c.timestamp.isoformat(), float(c.open), float(c.high), float(c.low), float(c.close), c.volume, c.oi]
            for c in candles
        ]
        
        try:
            prediction = self.predictor.predict(symbol, candle_rows)
            ml_signal = prediction["signal"]
            ml_confidence = prediction["confidence"]
        except Exception:
            ml_signal = "HOLD"
            ml_confidence = 0.5

        # Get news sentiment
        sentiment_score = 0.0
        sentiment_label = "neutral"
        if include_sentiment:
            company_name = COMPANY_NAMES.get(symbol, symbol.split("|")[-1])
            try:
                sentiment = await self.sentiment_service.get_stock_sentiment(symbol, company_name, hours=24)
                sentiment_score = sentiment["sentiment_score"]
                sentiment_label = sentiment["sentiment_label"]
            except Exception:
                pass

        sector = SECTOR_MAP.get(symbol, "Unknown")

        return StockScore(
            symbol=symbol,
            volatility=volatility,
            volume_surge=volume_surge,
            trend_strength=trend_strength,
            ml_confidence=ml_confidence,
            ml_signal=ml_signal,
            liquidity=liquidity,
            momentum=momentum,
            sector=sector,
            sentiment_score=sentiment_score,
            sentiment_label=sentiment_label,
        )

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        """Average True Range - volatility measure."""
        high_low = df["high"] - df["low"]
        high_close = abs(df["high"] - df["close"].shift())
        low_close = abs(df["low"] - df["close"].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        atr = true_range.rolling(period).mean().iloc[-1]
        # Normalize by price
        return float(atr / df["close"].iloc[-1]) if not pd.isna(atr) else 0.0

    def _calculate_volume_surge(self, df: pd.DataFrame, period: int = 20) -> float:
        """Current volume vs average volume."""
        current_vol = df["volume"].iloc[-1]
        avg_vol = df["volume"].rolling(period).mean().iloc[-1]
        return float(current_vol / avg_vol) if avg_vol > 0 else 1.0

    def _calculate_adx(self, df: pd.DataFrame, period: int = 14) -> float:
        """Average Directional Index - trend strength."""
        high = df["high"]
        low = df["low"]
        close = df["close"]
        
        plus_dm = high.diff()
        minus_dm = -low.diff()
        plus_dm[plus_dm < 0] = 0
        minus_dm[minus_dm < 0] = 0
        
        tr = pd.concat([
            high - low,
            abs(high - close.shift()),
            abs(low - close.shift())
        ], axis=1).max(axis=1)
        
        atr = tr.rolling(period).mean()
        plus_di = 100 * (plus_dm.rolling(period).mean() / atr)
        minus_di = 100 * (minus_dm.rolling(period).mean() / atr)
        
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
        adx = dx.rolling(period).mean().iloc[-1]
        
        return float(adx / 100) if not pd.isna(adx) else 0.0

    def _calculate_liquidity(self, df: pd.DataFrame) -> float:
        """Bid-ask spread proxy using high-low range."""
        recent = df.tail(20)
        avg_spread = ((recent["high"] - recent["low"]) / recent["close"]).mean()
        return float(avg_spread) if not pd.isna(avg_spread) else 0.01

    def _calculate_momentum(self, df: pd.DataFrame, period: int = 10) -> float:
        """Price momentum over recent period."""
        if len(df) < period:
            return 0.0
        momentum = (df["close"].iloc[-1] - df["close"].iloc[-period]) / df["close"].iloc[-period]
        return float(momentum)

    async def _persist_scores(self, scores: list[StockScore]) -> None:
        """Save scan results to database."""
        scan_time = datetime.now(timezone.utc)
        
        for score in scores:
            await self.db["stock_scores"].insert_one({
                "symbol": score.symbol,
                "scan_time": scan_time,
                "intraday_score": score.intraday_score,
                "volatility": score.volatility,
                "volume_surge": score.volume_surge,
                "trend_strength": score.trend_strength,
                "ml_confidence": score.ml_confidence,
                "ml_signal": score.ml_signal,
                "liquidity": score.liquidity,
                "momentum": score.momentum,
                "sector": score.sector,
                "sentiment_score": score.sentiment_score,
                "sentiment_label": score.sentiment_label,
            })

    async def get_latest_scan(self, limit: int = 10) -> list[dict[str, Any]]:
        """Retrieve most recent scan results."""
        cursor = self.db["stock_scores"].find(
            {},
            sort=[("scan_time", -1)],
            limit=limit
        )
        docs = await cursor.to_list(length=limit)
        
        return [
            {
                "symbol": d["symbol"],
                "intraday_score": d["intraday_score"],
                "volatility": d["volatility"],
                "volume_surge": d["volume_surge"],
                "trend_strength": d["trend_strength"],
                "ml_confidence": d["ml_confidence"],
                "ml_signal": d["ml_signal"],
                "liquidity": d["liquidity"],
                "momentum": d["momentum"],
                "sector": d["sector"],
                "sentiment_score": d.get("sentiment_score", 0.0),
                "sentiment_label": d.get("sentiment_label", "neutral"),
                "scan_time": d["scan_time"].isoformat(),
            }
            for d in docs
        ]
