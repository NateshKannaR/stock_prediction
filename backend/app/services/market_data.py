from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.trading import Candle


class MarketDataService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["candles"]

    async def persist_candles(self, instrument_key: str, interval: str, candle_rows: list[list]) -> int:
        inserted = 0
        for candle in candle_rows:
            ts = datetime.fromisoformat(str(candle[0]).replace("Z", "+00:00"))
            exists = await self.col.find_one({"instrument_key": instrument_key, "interval": interval, "timestamp": ts})
            if exists:
                continue
            await self.col.insert_one({
                "instrument_key": instrument_key,
                "interval": interval,
                "timestamp": ts,
                "open": float(candle[1]),
                "high": float(candle[2]),
                "low": float(candle[3]),
                "close": float(candle[4]),
                "volume": int(candle[5]),
                "oi": int(candle[6]) if len(candle) > 6 and candle[6] is not None else None,
                "source": "upstox",
            })
            inserted += 1
        return inserted

    async def recent_candles(
        self,
        instrument_key: str,
        interval: str,
        limit: int = 300,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ) -> list[Candle]:
        query: dict[str, object] = {"instrument_key": instrument_key, "interval": interval}
        timestamp_query: dict[str, datetime] = {}
        if from_date is not None:
            timestamp_query["$gte"] = from_date
        if to_date is not None:
            timestamp_query["$lte"] = to_date
        if timestamp_query:
            query["timestamp"] = timestamp_query

        cursor = self.col.find(query, sort=[("timestamp", -1)], limit=limit)
        docs = await cursor.to_list(length=limit)
        return list(reversed([
            Candle(
                instrument_key=d["instrument_key"],
                interval=d["interval"],
                timestamp=d["timestamp"],
                open=Decimal(str(d["open"])),
                high=Decimal(str(d["high"])),
                low=Decimal(str(d["low"])),
                close=Decimal(str(d["close"])),
                volume=d["volume"],
                oi=d.get("oi"),
                source=d.get("source", "upstox"),
                id=str(d["_id"]),
            )
            for d in docs
        ]))
