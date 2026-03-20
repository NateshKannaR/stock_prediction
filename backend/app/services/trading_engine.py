from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.trading import AutoTradingState, Position, Trade
from app.services.alerts import AlertService
from app.services.upstox import UpstoxService
from trading_engine.execution import build_upstox_order_payload
from trading_engine.risk import RiskManager


class TradingEngineService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.upstox = UpstoxService(db)
        self.alerts = AlertService()

    async def execute_signal(self, user_id: str, instrument_key: str, signal: str, last_price: float, strategy_name: str, paper_trading: bool) -> dict[str, Any]:
        state_doc = await self.db["auto_trading_state"].find_one({"user_id": user_id})
        if state_doc is None or not state_doc.get("enabled"):
            raise ValueError("Auto trading is disabled")

        risk_manager = RiskManager(
            daily_loss_limit=float(state_doc.get("daily_loss_limit", 0)),
            max_capital_allocation=float(state_doc.get("max_capital_allocation", 0)),
        )
        quantity = risk_manager.calculate_position_size(last_price=last_price, stop_loss_pct=1.5)
        side = "BUY" if signal == "BUY" else "SELL"
        order_payload = build_upstox_order_payload(
            instrument_token=instrument_key,
            quantity=quantity,
            transaction_type=side,
            order_type="MARKET",
            product="D",
            validity="DAY",
        )

        if paper_trading:
            order_response: dict[str, Any] = {"status": "paper_filled", "data": {"order_id": f"paper-{instrument_key}-{side}"}}
        else:
            credential = await self.upstox.get_credential(user_id)
            order_response = await self.upstox.place_order(credential.access_token, order_payload)

        await self.db["trades"].insert_one({
            "user_id": user_id,
            "strategy_name": strategy_name,
            "instrument_key": instrument_key,
            "side": side,
            "quantity": quantity,
            "price": float(last_price),
            "status": order_response.get("status", "submitted"),
            "upstox_order_id": order_response.get("data", {}).get("order_id"),
            "metadata_json": order_payload,
            "created_at": datetime.utcnow(),
        })

        signed_qty = quantity if side == "BUY" else -quantity
        await self.db["positions"].update_one(
            {"user_id": user_id, "instrument_key": instrument_key},
            {"$inc": {"quantity": signed_qty}, "$set": {"last_price": float(last_price), "updated_at": datetime.utcnow(), "average_price": float(last_price)}},
            upsert=True,
        )

        self.alerts.publish("trade.executed", {"instrument_key": instrument_key, "side": side, "quantity": quantity, "price": last_price})
        return order_response
