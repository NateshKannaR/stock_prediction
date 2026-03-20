from __future__ import annotations

import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, random_split

from ai_models.dataset import MarketDataset
from ai_models.features import FEATURE_COLUMNS
from ai_models.lstm_model import LSTMClassifier

logger = logging.getLogger(__name__)


def train_model(frame: pd.DataFrame, model_path: str, scaler_path: str, epochs: int = 30) -> dict:
    dataset = MarketDataset(frame)

    if len(dataset) < 100:
        raise ValueError(f"Not enough samples to train: {len(dataset)}. Need at least 100.")

    # 80/20 train/val split
    val_size = max(int(len(dataset) * 0.2), 10)
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=64, shuffle=False)

    model = LSTMClassifier(input_size=len(FEATURE_COLUMNS), hidden_size=128, num_layers=2, num_classes=3)
    loss_fn = nn.CrossEntropyLoss(weight=dataset.class_weights)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)

    best_val_loss = float("inf")
    best_state = None
    patience_counter = 0
    history = []

    for epoch in range(epochs):
        # Train
        model.train()
        train_loss = 0.0
        for features, targets in train_loader:
            optimizer.zero_grad()
            logits = model(features)
            loss = loss_fn(logits, targets)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_loss += loss.item()
        train_loss /= len(train_loader)

        # Validate
        model.eval()
        val_loss = 0.0
        correct = 0
        total = 0
        with torch.no_grad():
            for features, targets in val_loader:
                logits = model(features)
                val_loss += loss_fn(logits, targets).item()
                preds = logits.argmax(dim=1)
                correct += (preds == targets).sum().item()
                total += len(targets)
        val_loss /= len(val_loader)
        val_acc = correct / total * 100

        scheduler.step(val_loss)
        history.append({"epoch": epoch + 1, "train_loss": round(train_loss, 4), "val_loss": round(val_loss, 4), "val_acc": round(val_acc, 2)})
        logger.info("Epoch %d/%d — train_loss=%.4f val_loss=%.4f val_acc=%.1f%%", epoch + 1, epochs, train_loss, val_loss, val_acc)

        # Early stopping
        if val_loss < best_val_loss - 0.001:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= 5:
                logger.info("Early stopping at epoch %d", epoch + 1)
                break

    # Save best model
    if best_state:
        model.load_state_dict(best_state)
    Path(model_path).parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), model_path)
    joblib.dump(dataset.scaler, scaler_path)

    best_epoch = history[int(np.argmin([h["val_loss"] for h in history]))]
    return {
        "epochs_trained": len(history),
        "best_val_loss": round(best_val_loss, 4),
        "best_val_acc": best_epoch["val_acc"],
        "samples": len(dataset),
        "history": history[-5:],  # last 5 epochs
    }
