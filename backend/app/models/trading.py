from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any


@dataclass
class User:
    email: str
    password_hash: str
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    id: str | None = None


@dataclass
class UpstoxCredential:
    user_id: str
    access_token: str
    feed_token: str | None = None
    refresh_token: str | None = None
    expires_at: datetime | None = None
    profile: dict | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    id: str | None = None


@dataclass
class Candle:
    instrument_key: str
    interval: str
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    oi: int | None = None
    source: str = "upstox"
    id: str | None = None


@dataclass
class Trade:
    user_id: str
    strategy_name: str
    instrument_key: str
    side: str
    quantity: int
    price: Decimal
    status: str
    upstox_order_id: str | None = None
    pnl: Decimal | None = None
    metadata_json: dict | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    id: str | None = None


@dataclass
class Position:
    user_id: str
    instrument_key: str
    quantity: int
    average_price: Decimal
    last_price: Decimal | None = None
    unrealized_pnl: Decimal | None = None
    realized_pnl: Decimal | None = None
    updated_at: datetime = field(default_factory=datetime.utcnow)
    id: str | None = None


@dataclass
class StrategyConfig:
    user_id: str
    name: str
    instruments: list
    indicators: dict
    entry_rules: dict
    exit_rules: dict
    risk_params: dict
    is_active: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    id: str | None = None


@dataclass
class AutoTradingState:
    user_id: str
    enabled: bool = False
    paper_trading: bool = True
    daily_loss_limit: Decimal = field(default_factory=lambda: Decimal("0"))
    max_capital_allocation: Decimal = field(default_factory=lambda: Decimal("0"))
    updated_at: datetime = field(default_factory=datetime.utcnow)
    id: str | None = None
