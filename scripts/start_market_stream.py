from __future__ import annotations

import asyncio
import os

from app.api.routes import get_default_user
from app.db.session import SessionLocal
from app.services.market_stream import MarketStreamService, run_forever


def main() -> None:
    instrument_keys = [key.strip() for key in os.getenv("UPSTOX_STREAM_INSTRUMENTS", "").split(",") if key.strip()]
    if not instrument_keys:
        raise SystemExit("Set UPSTOX_STREAM_INSTRUMENTS with real instrument keys")

    with SessionLocal() as db:
        user = get_default_user(db)
        service = MarketStreamService(db, user.id)
        asyncio.run(run_forever(service, instrument_keys))


if __name__ == "__main__":
    main()

