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

        # Calculate expiry time - Upstox access_token typically expires in 24 hours
        expires_in = data.get("expires_in", 86400)  # Default to 24 hours if not provided
        expires_at = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(seconds=int(expires_in))
        
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
        """Extended tokens are long-lived and don't need refresh. This method is kept for compatibility.
        
        Note: Upstox extended_token is valid for ~1 year and should be used directly.
        If expired, user must re-authenticate via browser flow.
        """
        doc = await self.col.find_one({"user_id": user_id})
        if not doc:
            raise ValueError("No credentials stored. Please login via /auth/upstox/exchange.")
        
        extended_token = doc.get("extended_token")
        if extended_token:
            # Extended token is already long-lived, just return it
            return extended_token
        
        # No extended token available, user needs to re-authenticate
        raise ValueError("No extended_token available. Please re-authenticate via /auth/upstox/exchange.")

    async def get_token_status(self, user_id: str) -> dict[str, Any]:
        """Get the status of stored Upstox tokens."""
        doc = await self.col.find_one({"user_id": user_id})
        if not doc:
            return {"configured": False, "message": "No Upstox credentials found"}
        
        expires_at = doc.get("expires_at")
        has_extended = bool(doc.get("extended_token"))
        
        if not expires_at:
            return {
                "configured": True,
                "expired": False,
                "has_extended_token": has_extended,
                "message": "Token configured (no expiry info)",
                "updated_at": doc.get("updated_at"),
            }
        
        if isinstance(expires_at, datetime):
            exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
        else:
            exp = datetime.now(timezone.utc)
        
        now = datetime.now(timezone.utc)
        is_expired = now >= exp
        time_remaining = (exp - now).total_seconds() if not is_expired else 0
        
        return {
            "configured": True,
            "expired": is_expired,
            "expires_at": exp.isoformat(),
            "time_remaining_seconds": int(time_remaining),
            "time_remaining_hours": round(time_remaining / 3600, 2),
            "has_extended_token": has_extended,
            "message": "Token expired - re-authentication required" if is_expired else "Token active",
            "updated_at": doc.get("updated_at"),
        }

    async def get_credential(self, user_id: str) -> UpstoxCredential:
        doc = await self.col.find_one({"user_id": user_id})
        if doc is None and self.settings.upstox_access_token:
            return UpstoxCredential(user_id=user_id, access_token=self.settings.upstox_access_token)
        if doc is None:
            raise ValueError("Upstox credentials not configured")
        
        # Check if access_token is expired
        expires_at = doc.get("expires_at")
        if expires_at:
            if isinstance(expires_at, datetime):
                exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
            else:
                exp = datetime.now(timezone.utc)
            
            # If token expired or expiring within 10 minutes, raise error
            if datetime.now(timezone.utc) >= exp - timedelta(minutes=10):
                raise ValueError(
                    "Upstox access token expired. Please re-authenticate via /auth/upstox/exchange. "
                    "Note: Upstox extended_token cannot be used for automatic refresh - manual re-authentication required."
                )
        
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
