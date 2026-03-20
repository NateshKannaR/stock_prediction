from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from app.core.config import get_settings
from app.services.indicators import add_technical_indicators


class PredictionService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._try_load_lstm()

    def _try_load_lstm(self) -> None:
        self._lstm = None
        self._scaler = None
        try:
            import joblib, torch
            from ai_models.features import FEATURE_COLUMNS
            from ai_models.lstm_model import LSTMClassifier
            mp = Path(self.settings.model_path)
            sp = Path(self.settings.scaler_path)
            if mp.exists() and sp.exists():
                model = LSTMClassifier(input_size=len(FEATURE_COLUMNS), hidden_size=128, num_layers=2, num_classes=3)
                model.load_state_dict(torch.load(mp, map_location="cpu", weights_only=False))
                model.eval()
                self._lstm = model
                self._scaler = joblib.load(sp)
                self._feature_cols = FEATURE_COLUMNS
        except Exception:
            pass

    def _indicator_signal(self, df: pd.DataFrame) -> tuple[str, float, dict]:
        """Enhanced indicator-based signal with multi-timeframe analysis."""
        row = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else row

        # Get all indicators
        rsi_14 = float(row.get("rsi_14", 50))
        rsi_7 = float(row.get("rsi_7", 50))
        macd = float(row.get("macd", 0))
        macd_sig = float(row.get("macd_signal", 0))
        macd_diff = float(row.get("macd_diff", 0))
        macd_prev = float(prev.get("macd", 0))
        macd_sig_prev = float(prev.get("macd_signal", 0))
        
        close = float(row["close"])
        sma20 = float(row.get("sma_20", close))
        sma50 = float(row.get("sma_50", close))
        ema20 = float(row.get("ema_20", close))
        ema12 = float(row.get("ema_12", close))
        
        bb_high = float(row.get("bb_high", close * 1.02))
        bb_low = float(row.get("bb_low", close * 0.98))
        bb_mid = float(row.get("bb_mid", close))
        bb_position = float(row.get("bb_position", 0.5))
        
        atr = float(row.get("atr_14", 0))
        adx = float(row.get("adx_14", 0))
        
        vol = float(row.get("volume", 0))
        vol_ma = float(row.get("volume_ma_20", vol or 1))
        vol_ratio = float(row.get("volume_ratio", 1))
        
        returns = float(row.get("returns", 0))
        returns_3d = float(row.get("returns_3d", 0))
        returns_7d = float(row.get("returns_7d", 0))
        volatility = float(row.get("volatility_20", 0))
        
        price_to_sma20 = float(row.get("price_to_sma20", 0))
        price_to_sma50 = float(row.get("price_to_sma50", 0))

        buy_score = 0.0
        sell_score = 0.0

        # Multi-timeframe RSI analysis
        if rsi_14 < 30 and rsi_7 < 35:
            buy_score += 35  # Strong oversold
        elif rsi_14 < 40:
            buy_score += 20
        elif rsi_14 > 70 and rsi_7 > 65:
            sell_score += 35  # Strong overbought
        elif rsi_14 > 60:
            sell_score += 20

        # MACD analysis with histogram
        macd_cross_up = macd_prev < macd_sig_prev and macd > macd_sig
        macd_cross_down = macd_prev > macd_sig_prev and macd < macd_sig
        
        if macd_cross_up:
            buy_score += 30
        elif macd > macd_sig and macd_diff > 0:
            buy_score += 15
        
        if macd_cross_down:
            sell_score += 30
        elif macd < macd_sig and macd_diff < 0:
            sell_score += 15

        # Multi-timeframe trend analysis
        if close > sma20 and close > sma50 and sma20 > sma50:
            buy_score += 25  # Strong uptrend
        elif close > sma20 and close > ema20:
            buy_score += 15
        elif close < sma20 and close < sma50 and sma20 < sma50:
            sell_score += 25  # Strong downtrend
        elif close < sma20 and close < ema20:
            sell_score += 15

        # EMA crossover
        if ema12 > ema20:
            buy_score += 10
        elif ema12 < ema20:
            sell_score += 10

        # Bollinger Bands with position
        if bb_position < 0.2:
            buy_score += 25  # Near lower band
        elif bb_position < 0.4:
            buy_score += 10
        elif bb_position > 0.8:
            sell_score += 25  # Near upper band
        elif bb_position > 0.6:
            sell_score += 10

        # ADX for trend strength
        if adx > 25:  # Strong trend
            if buy_score > sell_score:
                buy_score += 15
            else:
                sell_score += 15

        # Volume confirmation with ratio
        if vol_ratio > 1.5:
            if buy_score > sell_score:
                buy_score += 15
            else:
                sell_score += 15
        elif vol_ratio > 1.2:
            if buy_score > sell_score:
                buy_score += 8
            else:
                sell_score += 8

        # Multi-timeframe momentum
        if returns_7d > 0.02 and returns_3d > 0.01:
            buy_score += 10
        elif returns_7d < -0.02 and returns_3d < -0.01:
            sell_score += 10

        # Calculate final signal
        total = buy_score + sell_score
        if total == 0:
            return "HOLD", 0.5, {}

        if buy_score > sell_score and buy_score >= 50:
            confidence = min(buy_score / (total + 30), 0.95)
            signal = "BUY"
        elif sell_score > buy_score and sell_score >= 50:
            confidence = min(sell_score / (total + 30), 0.95)
            signal = "SELL"
        else:
            confidence = 0.5
            signal = "HOLD"

        indicators = {
            "rsi_14": round(rsi_14, 2),
            "rsi_7": round(rsi_7, 2),
            "macd": round(macd, 4),
            "macd_signal": round(macd_sig, 4),
            "macd_diff": round(macd_diff, 4),
            "macd_crossover": "bullish" if macd_cross_up else "bearish" if macd_cross_down else "none",
            "sma_20": round(sma20, 2),
            "sma_50": round(sma50, 2),
            "ema_20": round(ema20, 2),
            "ema_12": round(ema12, 2),
            "bb_high": round(bb_high, 2),
            "bb_low": round(bb_low, 2),
            "bb_mid": round(bb_mid, 2),
            "bb_position_pct": round(bb_position * 100, 1),
            "atr_14": round(atr, 2),
            "adx_14": round(adx, 2),
            "volume_vs_avg": round(vol_ratio, 2),
            "volatility_20": round(volatility * 100, 3),
            "returns_pct": round(returns * 100, 3),
            "returns_3d_pct": round(returns_3d * 100, 3),
            "returns_7d_pct": round(returns_7d * 100, 3),
            "price_vs_sma20": round(price_to_sma20 * 100, 2),
            "price_vs_sma50": round(price_to_sma50 * 100, 2),
            "buy_score": round(buy_score, 1),
            "sell_score": round(sell_score, 1),
            "trend_strength": "strong" if adx > 25 else "weak",
        }
        return signal, round(confidence, 4), indicators

    def _lstm_signal(self, df: pd.DataFrame) -> tuple[str, float] | None:
        if self._lstm is None or self._scaler is None:
            return None
        try:
            import torch
            from ai_models.features import prepare_inference_frame
            features = prepare_inference_frame(df)
            latest = features.tail(60)
            if len(latest) < 60:
                return None
            scaled = self._scaler.transform(latest[self._feature_cols])
            tensor = torch.tensor(np.expand_dims(scaled, axis=0), dtype=torch.float32)
            with torch.no_grad():
                probs = torch.softmax(self._lstm(tensor), dim=1).numpy()[0]
            idx = int(np.argmax(probs))
            return ["SELL", "HOLD", "BUY"][idx], float(np.max(probs))
        except Exception:
            return None

    def predict(self, instrument_key: str, candles: list) -> dict:
        cols = ["timestamp", "open", "high", "low", "close", "volume", "oi"]
        frame = pd.DataFrame(candles, columns=cols)
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
        for col in ["open", "high", "low", "close"]:
            frame[col] = frame[col].astype(float)
        frame["volume"] = frame["volume"].astype(float)
        df = add_technical_indicators(frame)
        if df.empty:
            raise RuntimeError("Not enough candle data for indicators.")

        ind_signal, ind_conf, indicators = self._indicator_signal(df)
        lstm_result = self._lstm_signal(df)

        # Blend LSTM + indicators if LSTM available
        if lstm_result:
            lstm_signal, lstm_conf = lstm_result
            if lstm_signal == ind_signal:
                signal = lstm_signal
                confidence = (lstm_conf * 0.6 + ind_conf * 0.4)
            else:
                # Disagree — use higher confidence
                if lstm_conf > ind_conf:
                    signal, confidence = lstm_signal, lstm_conf * 0.7
                else:
                    signal, confidence = ind_signal, ind_conf * 0.7
            source = "lstm+indicators"
        else:
            signal, confidence = ind_signal, ind_conf
            source = "indicators"

        row = df.iloc[-1]
        close = float(row["close"])
        prev_close = float(df.iloc[-2]["close"]) if len(df) > 1 else close
        change = close - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0

        # Support / resistance from recent 20 candles
        recent = df.tail(20)
        support = float(recent["low"].min())
        resistance = float(recent["high"].max())

        # Dynamic target and stop based on ATR (Average True Range)
        atr = float(row.get("atr_14", close * 0.02))  # Default 2% if ATR not available
        volatility = float(row.get("volatility_20", 0.01))
        
        # Calculate risk-reward ratio based on volatility
        # Higher volatility = wider stops and targets
        atr_multiplier_target = 2.0 if volatility < 0.015 else 2.5 if volatility < 0.025 else 3.0
        atr_multiplier_stop = 1.5 if volatility < 0.015 else 2.0 if volatility < 0.025 else 2.5
        if signal == "BUY":
            # Target: Current price + (ATR * multiplier)
            target = round(close + (atr * atr_multiplier_target), 2)
            # Stop: Current price - (ATR * multiplier)
            stop = round(close - (atr * atr_multiplier_stop), 2)
            # Ensure minimum 1% target and 0.5% stop
            target = max(target, close * 1.01)
            stop = min(stop, close * 0.995)
        elif signal == "SELL":
            # Target: Current price - (ATR * multiplier)
            target = round(close - (atr * atr_multiplier_target), 2)
            # Stop: Current price + (ATR * multiplier)
            stop = round(close + (atr * atr_multiplier_stop), 2)
            # Ensure minimum 1% target and 0.5% stop
            target = min(target, close * 0.99)
            stop = max(stop, close * 1.005)
        else:
            target = close
            stop = close

        return {
            "instrument_key": instrument_key,
            "signal": signal,
            "confidence": round(confidence, 4),
            "last_close": close,
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "target_price": target,
            "stop_loss": stop,
            "support": round(support, 2),
            "resistance": round(resistance, 2),
            "source": source,
            "features": indicators,
            "generated_at": datetime.now(timezone.utc),
        }
