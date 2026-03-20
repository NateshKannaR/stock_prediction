from __future__ import annotations

import pandas as pd

FEATURE_COLUMNS = [
    "close",
    "volume",
    "rsi_14",
    "macd",
    "macd_signal",
    "sma_20",
    "ema_20",
    "bb_high",
    "bb_low",
    "volume_ma_20",
    "returns",
    "volatility_20",
]


def prepare_inference_frame(frame: pd.DataFrame) -> pd.DataFrame:
    return frame[FEATURE_COLUMNS].copy()

