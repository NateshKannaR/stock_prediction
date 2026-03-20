from __future__ import annotations

import pandas as pd

# Enhanced feature set for better predictions
FEATURE_COLUMNS = [
    # Price features
    "close",
    "high",
    "low",
    "open",
    "volume",
    
    # Momentum indicators
    "rsi_14",
    "rsi_7",  # Short-term RSI
    "macd",
    "macd_signal",
    "macd_diff",  # MACD histogram
    
    # Trend indicators
    "sma_20",
    "sma_50",  # Longer-term trend
    "ema_20",
    "ema_12",  # Faster EMA
    
    # Volatility indicators
    "bb_high",
    "bb_low",
    "bb_mid",  # Middle Bollinger Band
    "atr_14",  # Average True Range
    
    # Volume indicators
    "volume_ma_20",
    "volume_ratio",  # Current volume / MA
    
    # Price patterns
    "returns",
    "returns_3d",  # 3-day returns
    "returns_7d",  # 7-day returns
    "volatility_20",
    "volatility_10",  # Short-term volatility
    
    # Price position
    "price_to_sma20",  # Price relative to SMA20
    "price_to_sma50",  # Price relative to SMA50
    "bb_position",  # Position within Bollinger Bands
    
    # Trend strength
    "adx_14",  # Average Directional Index
]


def prepare_inference_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Prepare features for model inference with enhanced indicators."""
    df = frame.copy()
    
    # Add derived features if not present
    if "macd_diff" not in df.columns and "macd" in df.columns and "macd_signal" in df.columns:
        df["macd_diff"] = df["macd"] - df["macd_signal"]
    
    if "bb_mid" not in df.columns and "bb_high" in df.columns and "bb_low" in df.columns:
        df["bb_mid"] = (df["bb_high"] + df["bb_low"]) / 2
    
    if "volume_ratio" not in df.columns and "volume" in df.columns and "volume_ma_20" in df.columns:
        df["volume_ratio"] = df["volume"] / df["volume_ma_20"].replace(0, 1)
    
    if "returns_3d" not in df.columns and "close" in df.columns:
        df["returns_3d"] = df["close"].pct_change(3)
    
    if "returns_7d" not in df.columns and "close" in df.columns:
        df["returns_7d"] = df["close"].pct_change(7)
    
    if "volatility_10" not in df.columns and "returns" in df.columns:
        df["volatility_10"] = df["returns"].rolling(window=10).std()
    
    if "price_to_sma20" not in df.columns and "close" in df.columns and "sma_20" in df.columns:
        df["price_to_sma20"] = (df["close"] - df["sma_20"]) / df["sma_20"]
    
    if "price_to_sma50" not in df.columns and "close" in df.columns and "sma_50" in df.columns:
        df["price_to_sma50"] = (df["close"] - df["sma_50"]) / df["sma_50"]
    
    if "bb_position" not in df.columns and "close" in df.columns and "bb_high" in df.columns and "bb_low" in df.columns:
        bb_range = df["bb_high"] - df["bb_low"]
        df["bb_position"] = (df["close"] - df["bb_low"]) / bb_range.replace(0, 1)
    
    # Select only the features we need
    available_features = [col for col in FEATURE_COLUMNS if col in df.columns]
    return df[available_features].copy()

