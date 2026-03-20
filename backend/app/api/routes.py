from __future__ import annotations

import asyncio
from datetime import datetime, time, timezone
from decimal import Decimal

import pandas as pd
from bson import ObjectId
import httpx
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.schemas.common import (
    BacktestRequest,
    HistoryLoadRequest,
    LoginRequest,
    PredictionResponse,
    QuoteRequest,
    StrategyCreateRequest,
    ToggleAutoTradingRequest,
    TokenResponse,
    UpstoxExchangeRequest,
)
from app.services.auto_trader import get_status, start_auto_trader, stop_auto_trader
from app.services.backtester import Backtester
from app.services.market_data import MarketDataService
from app.services.predictor import PredictionService
from app.services.trading_engine import TradingEngineService
from app.services.upstox import UpstoxService

router = APIRouter(prefix="/api/v1")


async def get_default_user(db: AsyncIOMotorDatabase) -> dict:
    from app.core.config import get_settings
    settings = get_settings()
    user = await db["users"].find_one({"email": settings.default_admin_email})
    if user is None:
        result = await db["users"].insert_one({
            "email": settings.default_admin_email,
            "password_hash": hash_password(settings.default_admin_password),
            "is_active": True,
            "created_at": datetime.utcnow(),
        })
        user = await db["users"].find_one({"_id": result.inserted_id})
    return user


def _user_id(user: dict) -> str:
    return str(user["_id"])


@router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> TokenResponse:
    user = await db["users"].find_one({"email": payload.email})
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(str(user["_id"])))


@router.post("/auth/bootstrap-admin")
async def bootstrap_admin(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    return {"id": _user_id(user), "email": user["email"]}


@router.post("/auth/upstox/exchange")
async def exchange_upstox(payload: UpstoxExchangeRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    return await UpstoxService(db).exchange_code(_user_id(user), payload.code)


@router.get("/settings/upstox/status")
async def upstox_status(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    from app.core.config import get_settings
    user = await get_default_user(db)
    credential = await db["upstox_credentials"].find_one({"user_id": _user_id(user)})
    connected = credential is not None or bool(get_settings().upstox_access_token)
    return {"connected": connected, "updated_at": credential.get("updated_at") if credential else None}


@router.post("/market/quotes")
async def market_quotes(payload: QuoteRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    upstox = UpstoxService(db)
    credential = await upstox.get_credential(_user_id(user))
    try:
        return await upstox.get_quotes(credential.access_token, payload.instrument_keys)
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or str(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc


@router.post("/market/history/load")
async def load_market_history(payload: HistoryLoadRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    upstox = UpstoxService(db)
    credential = await upstox.get_credential(_user_id(user))
    try:
        data = await upstox.get_historical_candles(
            credential.access_token,
            payload.instrument_key,
            payload.interval,
            payload.to_date,
            payload.from_date,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or str(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    candle_rows = data.get("data", {}).get("candles", [])
    inserted = await MarketDataService(db).persist_candles(payload.instrument_key, payload.interval, candle_rows)
    return {"inserted": inserted, "received": len(candle_rows)}


@router.get("/market/history/{instrument_key}")
async def get_market_history(
    instrument_key: str,
    interval: str = "day",
    from_date: str | None = None,
    to_date: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    from_dt = None if from_date is None else datetime.combine(datetime.fromisoformat(from_date).date(), time.min, tzinfo=timezone.utc)
    to_dt = None if to_date is None else datetime.combine(datetime.fromisoformat(to_date).date(), time.max, tzinfo=timezone.utc)
    candles = await MarketDataService(db).recent_candles(instrument_key, interval, from_date=from_dt, to_date=to_dt)
    return {
        "instrument_key": instrument_key,
        "interval": interval,
        "candles": [
            {"timestamp": c.timestamp.isoformat(), "open": float(c.open), "high": float(c.high), "low": float(c.low), "close": float(c.close), "volume": c.volume}
            for c in candles
        ],
    }


@router.post("/predictions/train")
async def train_model(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    from ai_models.train import train_model as _train
    from app.core.config import get_settings
    settings = get_settings()
    service = MarketDataService(db)
    ALL = [
        "NSE_EQ|INE002A01018", "NSE_EQ|INE467B01029", "NSE_EQ|INE040A01034",
        "NSE_EQ|INE009A01021", "NSE_EQ|INE090A01021", "NSE_EQ|INE062A01020",
        "NSE_EQ|INE397D01024", "NSE_EQ|INE154A01025", "NSE_EQ|INE018A01030", "NSE_EQ|INE030A01027",
    ]
    frames = []
    for key in ALL:
        candles = await service.recent_candles(key, "day", limit=500)
        if len(candles) < 100:
            continue
        df = pd.DataFrame([{
            "timestamp": c.timestamp, "open": float(c.open), "high": float(c.high),
            "low": float(c.low), "close": float(c.close), "volume": c.volume,
        } for c in candles])
        frames.append(df)
    if not frames:
        raise HTTPException(status_code=400, detail="Not enough historical data. Load candles first.")
    combined = pd.concat(frames, ignore_index=True).sort_values("timestamp").reset_index(drop=True)
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _train(combined, settings.model_path, settings.scaler_path, epochs=30)
        )
        return {"status": "trained", **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/predictions/signals", response_model=list[PredictionResponse])
async def prediction_signals(instrument_keys: str | None = None, interval: str = "day", db: AsyncIOMotorDatabase = Depends(get_db)) -> list[PredictionResponse]:
    ALL = [
        "NSE_EQ|INE002A01018", "NSE_EQ|INE467B01029", "NSE_EQ|INE040A01034",
        "NSE_EQ|INE009A01021", "NSE_EQ|INE090A01021", "NSE_EQ|INE062A01020",
        "NSE_EQ|INE397D01024", "NSE_EQ|INE154A01025", "NSE_EQ|INE018A01030", "NSE_EQ|INE030A01027",
    ]
    keys = [k.strip() for k in instrument_keys.split(",")] if instrument_keys else ALL
    predictor = PredictionService()
    service = MarketDataService(db)
    results = []
    for instrument_key in keys:
        candles = await service.recent_candles(instrument_key, interval, limit=120)
        if len(candles) < 30:
            try:
                user = await get_default_user(db)
                upstox = UpstoxService(db)
                credential = await upstox.get_credential(_user_id(user))
                today = datetime.now(timezone.utc).date().isoformat()
                from_date = datetime.now(timezone.utc).replace(year=datetime.now(timezone.utc).year - 1).date().isoformat()
                data = await upstox.get_historical_candles(credential.access_token, instrument_key, interval, today, from_date)
                rows = data.get("data", {}).get("candles", [])
                await service.persist_candles(instrument_key, interval, rows)
                candles = await service.recent_candles(instrument_key, interval, limit=120)
            except Exception:
                continue
        if len(candles) < 30:
            continue
        candle_rows = [
            [c.timestamp.isoformat(), float(c.open), float(c.high), float(c.low), float(c.close), c.volume, c.oi]
            for c in candles
        ]
        try:
            results.append(PredictionResponse(**predictor.predict(instrument_key, candle_rows)))
        except Exception as e:
            continue
    return results


@router.post("/strategies")
async def create_strategy(payload: StrategyCreateRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    result = await db["strategy_configs"].insert_one({
        "user_id": _user_id(user),
        "name": payload.name,
        "instruments": payload.instruments,
        "indicators": payload.indicators,
        "entry_rules": payload.entry_rules,
        "exit_rules": payload.exit_rules,
        "risk_params": payload.risk_params,
        "is_active": False,
        "created_at": datetime.utcnow(),
    })
    return {"id": str(result.inserted_id)}


@router.get("/strategies")
async def list_strategies(db: AsyncIOMotorDatabase = Depends(get_db)) -> list[dict]:
    user = await get_default_user(db)
    cursor = db["strategy_configs"].find({"user_id": _user_id(user)})
    rows = await cursor.to_list(length=200)
    return [
        {"id": str(r["_id"]), "name": r["name"], "instruments": r["instruments"], "indicators": r["indicators"],
         "entry_rules": r["entry_rules"], "exit_rules": r["exit_rules"], "risk_params": r["risk_params"], "is_active": r["is_active"]}
        for r in rows
    ]


@router.post("/trading/auto-trading/toggle")
async def toggle_auto_trading(payload: ToggleAutoTradingRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    await db["auto_trading_state"].update_one(
        {"user_id": _user_id(user)},
        {"$set": {
            "enabled": payload.enabled,
            "paper_trading": payload.paper_trading,
            "daily_loss_limit": float(payload.daily_loss_limit),
            "max_capital_allocation": float(payload.max_capital_allocation),
            "profit_target_pct": payload.profit_target_pct,
            "stop_loss_pct": payload.stop_loss_pct,
            "updated_at": datetime.utcnow(),
        }},
        upsert=True,
    )
    if payload.enabled:
        start_auto_trader(interval_seconds=60)
    else:
        stop_auto_trader()
    return {"enabled": payload.enabled, "paper_trading": payload.paper_trading}


@router.get("/trading/auto-trading/status")
async def auto_trading_status(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    state = await db["auto_trading_state"].find_one({"user_id": _user_id(user)})
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_trades = await db["trades"].find({"user_id": _user_id(user), "created_at": {"$gte": today}}).to_list(length=10000)
    today_pnl = sum(float(t.get("pnl") or 0) for t in today_trades)
    loop = get_status()
    if state is None:
        return {"enabled": False, "paper_trading": True, "daily_loss_limit": 0, "max_capital_allocation": 0,
                "profit_target_pct": 1.0, "stop_loss_pct": 0.5,
                "today_trades": len(today_trades), "today_pnl": today_pnl, "loop": loop}
    return {"enabled": state["enabled"], "paper_trading": state["paper_trading"],
            "daily_loss_limit": float(state["daily_loss_limit"]), "max_capital_allocation": float(state["max_capital_allocation"]),
            "profit_target_pct": float(state.get("profit_target_pct", 1.0)), "stop_loss_pct": float(state.get("stop_loss_pct", 0.5)),
            "today_trades": len(today_trades), "today_pnl": today_pnl, "loop": loop}


@router.post("/trading/execute/{strategy_id}")
async def execute_strategy(strategy_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    strategy = await db["strategy_configs"].find_one({"_id": ObjectId(strategy_id), "user_id": _user_id(user)})
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    predictions = await prediction_signals(",".join(strategy["instruments"]), db=db)
    engine_service = TradingEngineService(db)
    state = await db["auto_trading_state"].find_one({"user_id": _user_id(user)})
    paper_trading = True if state is None else state.get("paper_trading", True)
    executions = []
    for prediction in predictions:
        if prediction.signal == "HOLD":
            continue
        executions.append(await engine_service.execute_signal(
            user_id=_user_id(user),
            instrument_key=prediction.instrument_key,
            signal=prediction.signal,
            last_price=prediction.last_close,
            strategy_name=strategy["name"],
            paper_trading=paper_trading,
        ))
    return {"executions": executions}


@router.post("/backtesting/run")
async def run_backtest(payload: BacktestRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    candles = await MarketDataService(db).recent_candles(payload.instrument_key, payload.interval, limit=2000)
    frame = pd.DataFrame([
        {"timestamp": c.timestamp, "open": float(c.open), "high": float(c.high), "low": float(c.low), "close": float(c.close), "volume": c.volume}
        for c in candles
    ])
    if frame.empty:
        raise HTTPException(status_code=400, detail="No historical data loaded for this instrument")
    return Backtester().run(frame, payload.starting_capital)


@router.get("/news")
async def market_news(q: str = "NSE stock market India") -> dict:
    from app.core.config import get_settings
    settings = get_settings()
    try:
        async with __import__('httpx').AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://newsdata.io/api/1/news",
                params={"apikey": settings.news_api_key, "country": "in", "category": "business", "language": "en", "q": q},
            )
            r.raise_for_status()
            data = r.json()
        articles = [
            {
                "title": a.get("title", ""),
                "description": a.get("description") or "",
                "url": a.get("link", ""),
                "source": a.get("source_name") or a.get("source_id", ""),
                "published_at": a.get("pubDate", ""),
                "image": a.get("image_url") or "",
            }
            for a in data.get("results", [])[:15]
            if a.get("title")
        ]
        return {"articles": articles}
    except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.HTTPStatusError):
        return {"articles": []}


@router.get("/account/funds")
async def account_funds(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    upstox = UpstoxService(db)
    credential = await upstox.get_credential(_user_id(user))
    async with __import__('httpx').AsyncClient(timeout=15) as c:
        r = await c.get(
            "https://api.upstox.com/v2/user/get-funds-and-margin",
            headers={"Authorization": f"Bearer {credential.access_token}", "Accept": "application/json"},
        )
        r.raise_for_status()
        data = r.json().get("data", {})
    equity = data.get("equity", {})
    return {
        "available_margin": equity.get("available_margin", 0),
        "used_margin": equity.get("used_margin", 0),
        "payin_amount": equity.get("payin_amount", 0),
        "notional_cash": equity.get("notional_cash", 0),
    }


@router.get("/portfolio/summary")
async def portfolio_summary(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    uid = _user_id(user)
    trades = await db["trades"].find({"user_id": uid}).to_list(length=10000)
    positions = await db["positions"].find({"user_id": uid}).to_list(length=1000)
    realized = sum(float(t.get("pnl") or 0) for t in trades)
    total_capital = sum(float(p["quantity"]) * float(p.get("last_price") or p["average_price"]) for p in positions)
    return {"total_capital": total_capital, "realized_pnl": realized, "open_positions": len(positions), "trade_count": len(trades)}


@router.get("/portfolio/positions")
async def portfolio_positions(db: AsyncIOMotorDatabase = Depends(get_db)) -> list[dict]:
    user = await get_default_user(db)
    rows = await db["trades"].find({"user_id": _user_id(user)}).to_list(length=10000)
    grouped: dict[str, dict] = {}
    for row in rows:
        bucket = grouped.setdefault(row["instrument_key"], {"instrument_key": row["instrument_key"], "net_quantity": 0, "average_price": 0.0, "last_trade_price": float(row["price"])})
        bucket["net_quantity"] += row["quantity"] if row["side"] == "BUY" else -row["quantity"]
        bucket["average_price"] = float(row["price"])
        bucket["last_trade_price"] = float(row["price"])
    return list(grouped.values())


@router.get("/trades/history")
async def trade_history(db: AsyncIOMotorDatabase = Depends(get_db)) -> list[dict]:
    user = await get_default_user(db)
    rows = await db["trades"].find({"user_id": _user_id(user)}, sort=[("created_at", -1)]).to_list(length=1000)
    return [
        {"id": str(r["_id"]), "strategy_name": r["strategy_name"], "instrument_key": r["instrument_key"],
         "side": r["side"], "quantity": r["quantity"], "price": float(r["price"]), "status": r["status"],
         "created_at": r["created_at"].isoformat()}
        for r in rows
    ]
