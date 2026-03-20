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
                model = LSTMClassifier(input_size=len(FEATURE_COLUMNS), hidden_size=64, num_layers=2, num_classes=3)
                model.load_state_dict(torch.load(mp, map_location="cpu"))
                model.eval()
                self._lstm = model
                self._scaler = joblib.load(sp)
                self._feature_cols = FEATURE_COLUMNS
        except Exception:
            pass

    def _indicator_signal(self, df: pd.DataFrame) -> tuple[str, float, dict]:
        """Full indicator-based signal with confidence score."""
        row = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else row

        rsi = float(row.get("rsi_14", 50))
        macd = float(row.get("macd", 0))
        macd_sig = float(row.get("macd_signal", 0))
        macd_prev = float(prev.get("macd", 0))
        macd_sig_prev = float(prev.get("macd_signal", 0))
        close = float(row["close"])
        sma20 = float(row.get("sma_20", close))
        ema20 = float(row.get("ema_20", close))
        bb_high = float(row.get("bb_high", close * 1.02))
        bb_low = float(row.get("bb_low", close * 0.98))
        vol = float(row.get("volume", 0))
        vol_ma = float(row.get("volume_ma_20", vol or 1))
        returns = float(row.get("returns", 0))
        volatility = float(row.get("volatility_20", 0))

        buy_score = 0.0
        sell_score = 0.0

        # RSI signals
        if rsi < 30:
            buy_score += 30   # oversold — strong buy
        elif rsi < 45:
            buy_score += 15
        elif rsi > 70:
            sell_score += 30  # overbought — strong sell
        elif rsi > 55:
            sell_score += 15

        # MACD crossover
        macd_cross_up = macd_prev < macd_sig_prev and macd > macd_sig
        macd_cross_down = macd_prev > macd_sig_prev and macd < macd_sig
        if macd_cross_up:
            buy_score += 25
        elif macd > macd_sig:
            buy_score += 10
        if macd_cross_down:
            sell_score += 25
        elif macd < macd_sig:
            sell_score += 10

        # Price vs SMA/EMA
        if close > sma20 and close > ema20:
            buy_score += 15
        elif close < sma20 and close < ema20:
            sell_score += 15

        # Bollinger band position
        bb_range = bb_high - bb_low
        if bb_range > 0:
            bb_pos = (close - bb_low) / bb_range
            if bb_pos < 0.2:
                buy_score += 20   # near lower band
            elif bb_pos > 0.8:
                sell_score += 20  # near upper band

        # Volume confirmation
        if vol > vol_ma * 1.5:
            if buy_score > sell_score:
                buy_score += 10
            else:
                sell_score += 10

        # Recent momentum
        if returns > 0.01:
            buy_score += 5
        elif returns < -0.01:
            sell_score += 5

        total = buy_score + sell_score
        if total == 0:
            return "HOLD", 0.5, {}

        if buy_score > sell_score and buy_score >= 40:
            confidence = min(buy_score / (total + 20), 0.95)
            signal = "BUY"
        elif sell_score > buy_score and sell_score >= 40:
            confidence = min(sell_score / (total + 20), 0.95)
            signal = "SELL"
        else:
            confidence = 0.5
            signal = "HOLD"

        indicators = {
            "rsi_14": round(rsi, 2),
            "macd": round(macd, 4),
            "macd_signal": round(macd_sig, 4),
            "macd_crossover": "bullish" if macd_cross_up else "bearish" if macd_cross_down else "none",
            "sma_20": round(sma20, 2),
            "ema_20": round(ema20, 2),
            "bb_high": round(bb_high, 2),
            "bb_low": round(bb_low, 2),
            "bb_position_pct": round((close - bb_low) / bb_range * 100, 1) if bb_range > 0 else 50,
            "volume_vs_avg": round(vol / vol_ma, 2) if vol_ma > 0 else 1,
            "volatility_20": round(volatility * 100, 3),
            "returns_pct": round(returns * 100, 3),
            "price_vs_sma": round((close - sma20) / sma20 * 100, 2),
            "buy_score": round(buy_score, 1),
            "sell_score": round(sell_score, 1),
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
        prev_close = float(df.iloc[-2]["close"]) if len(df) > 1 else float(row["close"])
        change = float(row["close"]) - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0

        # Support / resistance from recent 20 candles
        recent = df.tail(20)
        support = float(recent["low"].min())
        resistance = float(recent["high"].max())

        # Target and stop based on signal
        close = float(row["close"])
        if signal == "BUY":
            target = round(close * 1.015, 2)
            stop = round(close * 0.992, 2)
        elif signal == "SELL":
            target = round(close * 0.985, 2)
            stop = round(close * 1.008, 2)
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
