#!/usr/bin/env python3
"""
Load historical candles for all stocks in the intraday universe.
Run this once to populate the database before using the scanner.

Usage:
    python scripts/load_scanner_universe.py --interval 5minute --days 30
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.core.config import get_settings
from app.db.session import get_db
from app.models.watchlist import INTRADAY_UNIVERSE
from app.services.market_data import MarketDataService
from app.services.upstox import UpstoxService


async def load_universe(interval: str = "5minute", days: int = 30):
    """Load historical candles for all stocks in universe."""
    settings = get_settings()
    db = await get_db()
    
    upstox = UpstoxService(db)
    market_service = MarketDataService(db)
    
    # Get default user credential
    user = await db["users"].find_one({"email": settings.default_admin_email})
    if not user:
        print("❌ No user found. Run bootstrap-admin first.")
        return
    
    user_id = str(user["_id"])
    credential = await upstox.get_credential(user_id)
    
    to_date = datetime.now(timezone.utc).date().isoformat()
    from_date = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    
    print(f"📊 Loading {interval} candles for {len(INTRADAY_UNIVERSE)} stocks")
    print(f"📅 Date range: {from_date} to {to_date}\n")
    
    success = 0
    failed = 0
    
    for idx, symbol in enumerate(INTRADAY_UNIVERSE, 1):
        try:
            print(f"[{idx}/{len(INTRADAY_UNIVERSE)}] {symbol}...", end=" ")
            
            # Check existing candles
            existing = await market_service.recent_candles(symbol, interval, limit=1)
            if len(existing) > 0:
                print(f"✓ Already loaded ({len(existing)} candles)")
                success += 1
                continue
            
            # Fetch from Upstox
            data = await upstox.get_historical_candles(
                credential.access_token,
                symbol,
                interval,
                to_date,
                from_date,
            )
            
            candle_rows = data.get("data", {}).get("candles", [])
            if not candle_rows:
                print("⚠️  No data available")
                failed += 1
                continue
            
            # Persist to database
            inserted = await market_service.persist_candles(symbol, interval, candle_rows)
            print(f"✓ Loaded {inserted} candles")
            success += 1
            
            # Rate limit: 1 request per second
            await asyncio.sleep(1)
            
        except Exception as e:
            print(f"❌ Failed: {e}")
            failed += 1
    
    print(f"\n✅ Complete: {success} success, {failed} failed")
    print(f"🚀 Ready to use stock scanner!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Load historical data for scanner universe")
    parser.add_argument("--interval", default="5minute", help="Candle interval (1minute, 5minute, 15minute, 30minute, day)")
    parser.add_argument("--days", type=int, default=30, help="Number of days to load")
    
    args = parser.parse_args()
    
    asyncio.run(load_universe(args.interval, args.days))
