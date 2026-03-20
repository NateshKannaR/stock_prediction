from __future__ import annotations

import asyncio
import json
from typing import Iterable

import websockets
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.alerts import AlertService
from app.services.upstox import UpstoxService


class MarketStreamService:
    def __init__(self, db: AsyncIOMotorDatabase, user_id: str) -> None:
        self.db = db
        self.user_id = user_id
        self.upstox = UpstoxService(db)
        self.alerts = AlertService()

    async def stream(self, instrument_keys: Iterable[str]) -> None:
        credential = await self.upstox.get_credential(self.user_id)
        auth_response = await self.upstox.get_websocket_authorization(credential.access_token)
        authorized_url = auth_response.get("data", {}).get("authorized_redirect_uri") or auth_response.get("data", {}).get("authorized_redirect_url")
        if not authorized_url:
            raise RuntimeError("Upstox websocket authorization URL was not returned")

        async with websockets.connect(authorized_url, ping_interval=20, ping_timeout=20) as websocket:
            await websocket.send(json.dumps({
                "guid": "benx-market-stream",
                "method": "sub",
                "data": {"mode": "full", "instrumentKeys": list(instrument_keys)},
            }))
            while True:
                raw = await websocket.recv()
                self.alerts.publish("market.tick", self._normalize(raw))

    def _normalize(self, raw: str | bytes) -> dict:
        if isinstance(raw, bytes):
            try:
                raw = raw.decode("utf-8")
            except UnicodeDecodeError:
                return {"raw": list(raw)}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"raw": raw}


async def run_forever(service: MarketStreamService, instrument_keys: Iterable[str], retry_delay: int = 5) -> None:
    while True:
        try:
            await service.stream(instrument_keys)
        except Exception as exc:
            service.alerts.publish("risk.warning", {"message": f"market stream disconnected: {exc}"})
            await asyncio.sleep(retry_delay)
