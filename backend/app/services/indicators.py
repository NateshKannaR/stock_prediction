from __future__ import annotations

import pandas as pd
from ta.momentum import RSIIndicator
from ta.trend import EMAIndicator, MACD, SMAIndicator
from ta.volatility import BollingerBands


def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    enriched = df.copy()
    enriched["rsi_14"] = RSIIndicator(close=enriched["close"], window=14).rsi()
    macd = MACD(close=enriched["close"])
    enriched["macd"] = macd.macd()
    enriched["macd_signal"] = macd.macd_signal()
    enriched["sma_20"] = SMAIndicator(close=enriched["close"], window=20).sma_indicator()
    enriched["ema_20"] = EMAIndicator(close=enriched["close"], window=20).ema_indicator()
    bands = BollingerBands(close=enriched["close"], window=20, window_dev=2)
    enriched["bb_high"] = bands.bollinger_hband()
    enriched["bb_low"] = bands.bollinger_lband()
    enriched["volume_ma_20"] = enriched["volume"].rolling(window=20).mean()
    enriched["returns"] = enriched["close"].pct_change()
    enriched["volatility_20"] = enriched["returns"].rolling(window=20).std()
    return enriched.dropna().reset_index(drop=True)

