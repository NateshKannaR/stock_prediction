from __future__ import annotations

import pandas as pd
from ta.momentum import RSIIndicator
from ta.trend import ADXIndicator, EMAIndicator, MACD, SMAIndicator
from ta.volatility import AverageTrueRange, BollingerBands


def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add comprehensive technical indicators for enhanced predictions."""
    enriched = df.copy()
    
    # Momentum indicators
    enriched["rsi_14"] = RSIIndicator(close=enriched["close"], window=14).rsi()
    enriched["rsi_7"] = RSIIndicator(close=enriched["close"], window=7).rsi()
    
    macd = MACD(close=enriched["close"])
    enriched["macd"] = macd.macd()
    enriched["macd_signal"] = macd.macd_signal()
    enriched["macd_diff"] = macd.macd_diff()
    
    # Trend indicators
    enriched["sma_20"] = SMAIndicator(close=enriched["close"], window=20).sma_indicator()
    enriched["sma_50"] = SMAIndicator(close=enriched["close"], window=50).sma_indicator()
    enriched["ema_20"] = EMAIndicator(close=enriched["close"], window=20).ema_indicator()
    enriched["ema_12"] = EMAIndicator(close=enriched["close"], window=12).ema_indicator()
    
    # Volatility indicators
    bands = BollingerBands(close=enriched["close"], window=20, window_dev=2)
    enriched["bb_high"] = bands.bollinger_hband()
    enriched["bb_low"] = bands.bollinger_lband()
    enriched["bb_mid"] = bands.bollinger_mavg()
    
    atr = AverageTrueRange(high=enriched["high"], low=enriched["low"], close=enriched["close"], window=14)
    enriched["atr_14"] = atr.average_true_range()
    
    # Volume indicators
    enriched["volume_ma_20"] = enriched["volume"].rolling(window=20).mean()
    enriched["volume_ratio"] = enriched["volume"] / enriched["volume_ma_20"].replace(0, 1)
    
    # Returns and volatility
    enriched["returns"] = enriched["close"].pct_change()
    enriched["returns_3d"] = enriched["close"].pct_change(3)
    enriched["returns_7d"] = enriched["close"].pct_change(7)
    enriched["volatility_20"] = enriched["returns"].rolling(window=20).std()
    enriched["volatility_10"] = enriched["returns"].rolling(window=10).std()
    
    # Price position indicators
    enriched["price_to_sma20"] = (enriched["close"] - enriched["sma_20"]) / enriched["sma_20"]
    enriched["price_to_sma50"] = (enriched["close"] - enriched["sma_50"]) / enriched["sma_50"]
    
    bb_range = enriched["bb_high"] - enriched["bb_low"]
    enriched["bb_position"] = (enriched["close"] - enriched["bb_low"]) / bb_range.replace(0, 1)
    
    # Trend strength
    adx = ADXIndicator(high=enriched["high"], low=enriched["low"], close=enriched["close"], window=14)
    enriched["adx_14"] = adx.adx()
    
    return enriched.dropna().reset_index(drop=True)

