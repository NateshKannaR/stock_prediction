from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UpstoxExchangeRequest(BaseModel):
    code: str


class QuoteRequest(BaseModel):
    instrument_keys: list[str]


class HistoryLoadRequest(BaseModel):
    instrument_key: str
    interval: str
    to_date: str | None = None
    from_date: str | None = None


class StrategyCreateRequest(BaseModel):
    name: str
    instruments: list[str]
    indicators: dict[str, Any]
    entry_rules: dict[str, Any]
    exit_rules: dict[str, Any]
    risk_params: dict[str, Any]


class PredictionResponse(BaseModel):
    instrument_key: str
    signal: Literal["BUY", "SELL", "HOLD"]
    confidence: float
    last_close: float
    change: float = 0.0
    change_pct: float = 0.0
    target_price: float = 0.0
    stop_loss: float = 0.0
    support: float = 0.0
    resistance: float = 0.0
    source: str = "indicators"
    features: dict[str, float | str]
    generated_at: datetime


class ToggleAutoTradingRequest(BaseModel):
    enabled: bool
    paper_trading: bool = True
    daily_loss_limit: Decimal
    max_capital_allocation: Decimal
    profit_target_pct: float = 1.0
    stop_loss_pct: float = 0.5


class BacktestRequest(BaseModel):
    instrument_key: str
    interval: str = "day"
    starting_capital: float
    strategy_id: int

