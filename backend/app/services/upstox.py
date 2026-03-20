from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.models.trading import UpstoxCredential


class UpstoxService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db["upstox_credentials"]
        self.settings = get_settings()

    def _headers(self, access_token: str) -> dict[str, str]:
        return {"Accept": "application/json", "Authorization": f"Bearer {access_token}"}

    async def exchange_code(self, user_id: str, code: str) -> dict[str, Any]:
        payload = {
            "code": code,
            "client_id": self.settings.upstox_client_id,
            "client_secret": self.settings.upstox_client_secret,
            "redirect_uri": self.settings.upstox_redirect_uri,
            "grant_type": "authorization_code",
        }
        headers = {"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self.settings.upstox_token_url, data=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        expires_in = data.get("expires_in")
        expires_at = None if expires_in is None else datetime.now(timezone.utc).replace(microsecond=0) + timedelta(seconds=int(expires_in))
        await self.col.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "access_token": data["access_token"],
                "extended_token": data.get("extended_token"),
                "refresh_token": data.get("refresh_token"),
                "feed_token": data.get("feed_token"),
                "expires_at": expires_at,
                "updated_at": datetime.utcnow(),
            }},
            upsert=True,
        )
        return data

    async def refresh_access_token(self, user_id: str) -> str:
        """Use extended_token to get a fresh access_token without browser login."""
        doc = await self.col.find_one({"user_id": user_id})
        if not doc or not doc.get("extended_token"):
            raise ValueError("No extended_token stored. Please login once via /auth/upstox/exchange.")
        extended_token = doc["extended_token"]
        payload = {
            "token": extended_token,
            "client_id": self.settings.upstox_client_id,
            "client_secret": self.settings.upstox_client_secret,
        }
        headers = {"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api-v2.upstox.com/login/authorization/token",
                data=payload,
                headers={**headers, "Authorization": f"Bearer {extended_token}"},
            )
            if response.status_code != 200:
                # fallback: try grant_type=refresh_token
                payload2 = {
                    "grant_type": "refresh_token",
                    "refresh_token": extended_token,
                    "client_id": self.settings.upstox_client_id,
                    "client_secret": self.settings.upstox_client_secret,
                }
                response = await client.post(self.settings.upstox_token_url, data=payload2, headers=headers)
            response.raise_for_status()
            data = response.json()
        new_token = data.get("access_token")
        if not new_token:
            raise ValueError(f"Refresh failed: {data}")
        expires_in = data.get("expires_in")
        expires_at = None if not expires_in else datetime.now(timezone.utc).replace(microsecond=0) + timedelta(seconds=int(expires_in))
        await self.col.update_one(
            {"user_id": user_id},
            {"$set": {"access_token": new_token, "expires_at": expires_at, "updated_at": datetime.utcnow()}},
        )
        return new_token

    async def get_credential(self, user_id: str) -> UpstoxCredential:
        doc = await self.col.find_one({"user_id": user_id})
        if doc is None and self.settings.upstox_access_token:
            return UpstoxCredential(user_id=user_id, access_token=self.settings.upstox_access_token)
        if doc is None:
            raise ValueError("Upstox credentials not configured")
        # Auto-refresh if expired or expiring within 10 minutes
        expires_at = doc.get("expires_at")
        if expires_at and doc.get("extended_token"):
            if isinstance(expires_at, datetime):
                exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
            else:
                exp = datetime.now(timezone.utc)  # treat as expired
            if datetime.now(timezone.utc) >= exp - timedelta(minutes=10):
                try:
                    access_token = await self.refresh_access_token(user_id)
                    doc["access_token"] = access_token
                except Exception:
                    pass  # use existing token if refresh fails
        return UpstoxCredential(
            user_id=doc["user_id"],
            access_token=doc["access_token"],
            feed_token=doc.get("feed_token"),
            refresh_token=doc.get("refresh_token"),
            expires_at=doc.get("expires_at"),
            id=str(doc["_id"]),
        )

    async def get_quotes(self, access_token: str, instrument_keys: list[str]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.settings.upstox_api_base_url}/v2/market-quote/quotes",
                params={"instrument_key": ",".join(instrument_keys)},
                headers=self._headers(access_token),
            )
            response.raise_for_status()
            return response.json()

    async def get_historical_candles(self, access_token: str, instrument_key: str, interval: str, to_date: str | None, from_date: str | None) -> dict[str, Any]:
        encoded_instrument_key = quote(instrument_key, safe="")
        if interval == "1minute":
            url = f"{self.settings.upstox_api_base_url}/v3/historical-candle/intraday/{encoded_instrument_key}/minutes/1"
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(url, headers=self._headers(access_token))
                response.raise_for_status()
                return response.json()

        if interval == "30minute":
            url = f"{self.settings.upstox_api_base_url}/v3/historical-candle/intraday/{encoded_instrument_key}/minutes/30"
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(url, headers=self._headers(access_token))
                response.raise_for_status()
                return response.json()

        effective_to_date = to_date or datetime.now(timezone.utc).date().isoformat()
        url = f"{self.settings.upstox_api_base_url}/v2/historical-candle/{encoded_instrument_key}/{interval}/{effective_to_date}"
        if from_date:
            url = f"{url}/{from_date}"
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(url, headers=self._headers(access_token))
            response.raise_for_status()
            return response.json()

    async def place_order(self, access_token: str, order_payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.settings.upstox_hft_base_url}/v3/order/place",
                json=order_payload,
                headers={**self._headers(access_token), "Content-Type": "application/json"},
            )
            response.raise_for_status()
            return response.json()

    async def get_websocket_authorization(self, access_token: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(self.settings.upstox_market_feed_authorize_url, headers=self._headers(access_token))
            response.raise_for_status()
            return response.json()
