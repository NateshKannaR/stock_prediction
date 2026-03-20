#!/usr/bin/env python
"""Retrain LSTM model with current data and architecture."""
import asyncio
import sys
from pathlib import Path

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient

from ai_models.train import train_model
from app.core.config import get_settings


async def main():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db]
    
    print("Fetching historical candles from MongoDB...")
    cursor = db['candles'].find({'interval': 'day'}).sort('timestamp', 1)
    candles = await cursor.to_list(length=100000)
    
    if len(candles) < 1000:
        print(f"❌ Not enough data: {len(candles)} candles. Need at least 1000.")
        print("Run: POST /api/v1/market/history/load to fetch historical data first.")
        client.close()
        return 1
    
    print(f"✓ Found {len(candles)} candles")
    
    # Convert to DataFrame
    df = pd.DataFrame([{
        'timestamp': c['timestamp'],
        'open': float(c['open']),
        'high': float(c['high']),
        'low': float(c['low']),
        'close': float(c['close']),
        'volume': int(c['volume']),
    } for c in candles])
    
    print(f"✓ Prepared {len(df)} rows for training")
    print(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    
    # Train model
    print("\nTraining LSTM model...")
    result = train_model(
        df,
        model_path=settings.model_path,
        scaler_path=settings.scaler_path,
        epochs=30
    )
    
    print("\n✅ Training complete!")
    print(f"   Epochs: {result['epochs_trained']}")
    print(f"   Best validation loss: {result['best_val_loss']}")
    print(f"   Best validation accuracy: {result['best_val_acc']}%")
    print(f"   Training samples: {result['samples']}")
    print(f"\n   Model saved to: {settings.model_path}")
    print(f"   Scaler saved to: {settings.scaler_path}")
    
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
