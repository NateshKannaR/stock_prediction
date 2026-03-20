from __future__ import annotations

import numpy as np
import pandas as pd
import torch
from sklearn.preprocessing import StandardScaler
from torch.utils.data import Dataset

from ai_models.features import FEATURE_COLUMNS
from app.services.indicators import add_technical_indicators


class MarketDataset(Dataset):
    def __init__(self, frame: pd.DataFrame, sequence_length: int = 60) -> None:
        enriched = add_technical_indicators(frame)

        # Better labels: use 3-day forward return to reduce noise
        enriched["future_return"] = enriched["close"].shift(-3) / enriched["close"] - 1

        # Dynamic thresholds based on volatility
        vol = enriched["close"].pct_change().rolling(20).std().fillna(0.01)
        enriched["target"] = 1  # HOLD
        enriched.loc[enriched["future_return"] > vol * 1.5, "target"] = 2   # BUY
        enriched.loc[enriched["future_return"] < -vol * 1.5, "target"] = 0  # SELL

        enriched = enriched.dropna().reset_index(drop=True)

        self.scaler = StandardScaler()
        scaled = self.scaler.fit_transform(enriched[FEATURE_COLUMNS])

        self.features: list = []
        self.targets: list = []
        for idx in range(sequence_length, len(enriched)):
            self.features.append(scaled[idx - sequence_length: idx])
            self.targets.append(int(enriched.iloc[idx]["target"]))

        self.features = np.asarray(self.features, dtype=np.float32)
        self.targets = np.asarray(self.targets, dtype=np.int64)

        # Compute class weights for imbalanced labels
        counts = np.bincount(self.targets, minlength=3).astype(float)
        counts = np.where(counts == 0, 1, counts)
        self.class_weights = torch.tensor(1.0 / counts / (1.0 / counts).sum(), dtype=torch.float32)

    def __len__(self) -> int:
        return len(self.targets)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        return torch.tensor(self.features[index]), torch.tensor(self.targets[index])
