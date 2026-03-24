from __future__ import annotations

import asyncio
from datetime import datetime, time, timedelta, timezone
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
from app.services.news_sentiment import COMPANY_NAMES, NewsSentimentService
from app.services.predictor import PredictionService
from app.services.stock_scanner import StockScannerService
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
    result = await UpstoxService(db).exchange_code(_user_id(user), payload.code)
    return {"success": True, "message": "Upstox connected successfully", "data": result}


@router.post("/auth/upstox/refresh")
async def refresh_upstox_token(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    """Check Upstox token status. Note: Upstox tokens cannot be auto-refreshed."""
    user = await get_default_user(db)
    upstox = UpstoxService(db)
    status = await upstox.get_token_status(_user_id(user))
    
    if not status["configured"]:
        raise HTTPException(status_code=404, detail="No Upstox credentials found. Please authenticate first.")
    
    if status["expired"]:
        raise HTTPException(
            status_code=401,
            detail="Upstox access token expired. Please re-authenticate via /auth/upstox/exchange. "
                   "Note: Upstox extended_token cannot be used for automatic refresh."
        )
    
    return {
        "success": True,
        "message": status["message"],
        "status": status,
        "note": "Upstox tokens expire after ~24 hours and require manual re-authentication."
    }


@router.get("/settings/upstox/status")
async def upstox_status(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    from app.core.config import get_settings
    user = await get_default_user(db)
    upstox = UpstoxService(db)
    
    # Check if using env variable token
    if get_settings().upstox_access_token:
        return {
            "connected": True,
            "source": "environment_variable",
            "message": "Using UPSTOX_ACCESS_TOKEN from environment"
        }
    
    # Get token status from database
    status = await upstox.get_token_status(_user_id(user))
    return {
        "connected": status["configured"],
        "source": "database",
        **status
    }


@router.get("/settings/upstox/auth-url")
async def upstox_auth_url() -> dict:
    """Get Upstox authorization URL for re-authentication."""
    from app.core.config import get_settings
    settings = get_settings()
    auth_url = (
        f"{settings.upstox_auth_url}"
        f"?client_id={settings.upstox_client_id}"
        f"&redirect_uri={settings.upstox_redirect_uri}"
        f"&response_type=code"
    )
    return {"auth_url": auth_url}


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
        "NSE_EQ|INE397D01024", "NSE_EQ|INE154A01025", "NSE_EQ|INE018A01030",
        "NSE_EQ|INE030A01027", "NSE_EQ|INE155A01022", "NSE_EQ|INE721A01013",
        "NSE_EQ|INE019A01038", "NSE_EQ|INE238A01034", "NSE_EQ|INE120A01034",
        "NSE_EQ|INE752E01010", "NSE_EQ|INE742F01042", "NSE_EQ|INE066A01021",
        "NSE_EQ|INE101D01020", "NSE_EQ|INE239A01016", "NSE_EQ|INE040H01021",
        "NSE_EQ|INE002S01010", "NSE_EQ|INE192A01025", "NSE_EQ|INE114A01011",
        "NSE_EQ|INE296A01024", "NSE_EQ|INE860A01027", "NSE_EQ|INE075A01022",
        "NSE_EQ|INE769A01020", "NSE_EQ|INE213A01029", "NSE_EQ|INE021A01026",
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


@router.post("/scanner/scan")
async def scan_stocks(
    payload: dict,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Scan stock universe and return top N ranked stocks for intraday."""
    interval = payload.get("interval", "5minute")
    top_n = payload.get("top_n", 5)
    min_candles = payload.get("min_candles", 100)
    include_sentiment = payload.get("include_sentiment", True)
    
    scanner = StockScannerService(db)
    top_stocks = await scanner.scan_universe(interval, min_candles, top_n, include_sentiment)
    
    return {
        "top_stocks": top_stocks,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "interval": interval,
        "total_scanned": len(top_stocks),
        "sentiment_enabled": include_sentiment,
    }


@router.get("/scanner/latest")
async def get_latest_scan(
    limit: int = 10,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Get latest scan results from database."""
    scanner = StockScannerService(db)
    results = await scanner.get_latest_scan(limit)
    return {"results": results}


@router.get("/sentiment/{instrument_key}")
async def get_stock_sentiment(
    instrument_key: str,
    hours: int = 24,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Get news sentiment for a specific stock."""
    company_name = COMPANY_NAMES.get(instrument_key, instrument_key.split("|")[-1])
    sentiment_service = NewsSentimentService(db)
    return await sentiment_service.get_stock_sentiment(instrument_key, company_name, hours)


@router.get("/sentiment/{instrument_key}/history")
async def get_sentiment_history(
    instrument_key: str,
    days: int = 7,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Get historical sentiment for a stock."""
    sentiment_service = NewsSentimentService(db)
    history = await sentiment_service.get_sentiment_history(instrument_key, days)
    return {"instrument_key": instrument_key, "history": history}


@router.get("/predictions/signals", response_model=list[PredictionResponse])
async def prediction_signals(instrument_keys: str | None = None, interval: str = "day", db: AsyncIOMotorDatabase = Depends(get_db)) -> list[PredictionResponse]:
    ALL = [
        "NSE_EQ|INE002A01018", "NSE_EQ|INE467B01029", "NSE_EQ|INE040A01034",
        "NSE_EQ|INE009A01021", "NSE_EQ|INE090A01021", "NSE_EQ|INE062A01020",
        "NSE_EQ|INE397D01024", "NSE_EQ|INE154A01025", "NSE_EQ|INE018A01030",
        "NSE_EQ|INE030A01027", "NSE_EQ|INE155A01022", "NSE_EQ|INE721A01013",
        "NSE_EQ|INE019A01038", "NSE_EQ|INE238A01034", "NSE_EQ|INE120A01034",
        "NSE_EQ|INE752E01010", "NSE_EQ|INE742F01042", "NSE_EQ|INE066A01021",
        "NSE_EQ|INE101D01020", "NSE_EQ|INE239A01016", "NSE_EQ|INE040H01021",
        "NSE_EQ|INE002S01010", "NSE_EQ|INE192A01025", "NSE_EQ|INE114A01011",
        "NSE_EQ|INE296A01024", "NSE_EQ|INE860A01027", "NSE_EQ|INE075A01022",
        "NSE_EQ|INE769A01020", "NSE_EQ|INE213A01029", "NSE_EQ|INE021A01026",
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


@router.post("/trading/scalping/toggle")
async def toggle_scalping(payload: dict, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    enabled = payload.get("enabled", False)
    interval = payload.get("interval", "1minute")  # 1minute or 5minute
    
    await db["intraday_scalping_state"].update_one(
        {"user_id": _user_id(user)},
        {"$set": {
            "enabled": enabled,
            "scalping_interval": interval,
            "paper_trading": payload.get("paper_trading", True),
            "daily_loss_limit": float(payload.get("daily_loss_limit", 2000)),
            "max_capital_allocation": float(payload.get("max_capital_allocation", 50000)),
            "updated_at": datetime.utcnow(),
        }},
        upsert=True,
    )
    
    if enabled:
        from app.services.intraday_scalper import start_scalping_bot
        start_scalping_bot(interval_seconds=10)
    else:
        from app.services.intraday_scalper import stop_scalping_bot
        stop_scalping_bot()
    
    return {"enabled": enabled, "interval": interval}


@router.get("/trading/scalping/status")
async def scalping_status(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    state = await db["intraday_scalping_state"].find_one({"user_id": _user_id(user)})
    
    from app.services.intraday_scalper import get_scalping_status
    loop_status = get_scalping_status()
    
    if state is None:
        return {
            "enabled": False,
            "interval": "1minute",
            "paper_trading": True,
            "daily_loss_limit": 2000,
            "max_capital_allocation": 50000,
            "today_trades": 0,
            "today_pnl": 0,
            "loop": loop_status,
        }
    
    return {
        "enabled": state["enabled"],
        "interval": state.get("scalping_interval", "1minute"),
        "paper_trading": state["paper_trading"],
        "daily_loss_limit": float(state["daily_loss_limit"]),
        "max_capital_allocation": float(state["max_capital_allocation"]),
        "today_trades": loop_status.get("today_trades", 0),
        "today_pnl": loop_status.get("today_pnl", 0),
        "loop": loop_status,
    }


@router.post("/trading/auto-trading/toggle")
async def toggle_auto_trading(payload: ToggleAutoTradingRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    
    # Extract additional parameters with defaults
    trailing_stop_enabled = payload.dict().get("trailing_stop_enabled", True)
    trailing_stop_pct = payload.dict().get("trailing_stop_pct", 0.5)
    max_positions = payload.dict().get("max_positions", 3)
    risk_per_trade_pct = payload.dict().get("risk_per_trade_pct", 2.0)
    max_trades_per_day = payload.dict().get("max_trades_per_day", 10)
    
    await db["auto_trading_state"].update_one(
        {"user_id": _user_id(user)},
        {"$set": {
            "enabled": payload.enabled,
            "paper_trading": payload.paper_trading,
            "daily_loss_limit": float(payload.daily_loss_limit),
            "max_capital_allocation": float(payload.max_capital_allocation),
            "profit_target_pct": payload.profit_target_pct,
            "stop_loss_pct": payload.stop_loss_pct,
            "trailing_stop_enabled": trailing_stop_enabled,
            "trailing_stop_pct": trailing_stop_pct,
            "max_positions": max_positions,
            "risk_per_trade_pct": risk_per_trade_pct,
            "max_trades_per_day": max_trades_per_day,
            "updated_at": datetime.utcnow(),
        }},
        upsert=True,
    )
    if payload.enabled:
        start_auto_trader(interval_seconds=60)
    else:
        stop_auto_trader()
    return {
        "enabled": payload.enabled,
        "paper_trading": payload.paper_trading,
        "trailing_stop_enabled": trailing_stop_enabled,
        "max_positions": max_positions,
    }


@router.get("/trading/auto-trading/status")
async def auto_trading_status(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    user = await get_default_user(db)
    state = await db["auto_trading_state"].find_one({"user_id": _user_id(user)})
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_trades = await db["trades"].find({"user_id": _user_id(user), "created_at": {"$gte": today}}).to_list(length=10000)
    today_pnl = sum(float(t.get("pnl") or 0) for t in today_trades)
    loop = get_status()
    
    if state is None:
        return {
            "enabled": False,
            "paper_trading": True,
            "daily_loss_limit": 0,
            "max_capital_allocation": 0,
            "profit_target_pct": 1.5,
            "stop_loss_pct": 0.75,
            "trailing_stop_enabled": True,
            "trailing_stop_pct": 0.5,
            "max_positions": 3,
            "risk_per_trade_pct": 2.0,
            "max_trades_per_day": 10,
            "today_trades": len(today_trades),
            "today_pnl": today_pnl,
            "loop": loop,
        }
    
    return {
        "enabled": state["enabled"],
        "paper_trading": state["paper_trading"],
        "daily_loss_limit": float(state["daily_loss_limit"]),
        "max_capital_allocation": float(state["max_capital_allocation"]),
        "profit_target_pct": float(state.get("profit_target_pct", 1.5)),
        "stop_loss_pct": float(state.get("stop_loss_pct", 0.75)),
        "trailing_stop_enabled": state.get("trailing_stop_enabled", True),
        "trailing_stop_pct": float(state.get("trailing_stop_pct", 0.5)),
        "max_positions": int(state.get("max_positions", 3)),
        "risk_per_trade_pct": float(state.get("risk_per_trade_pct", 2.0)),
        "max_trades_per_day": int(state.get("max_trades_per_day", 10)),
        "today_trades": len(today_trades),
        "today_pnl": today_pnl,
        "loop": loop,
    }


@router.get("/trading/auto-trading/performance")
async def auto_trading_performance(days: int = 30, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    """Get detailed performance analytics for auto trading."""
    user = await get_default_user(db)
    from_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
    
    trades = await db["trades"].find({
        "user_id": _user_id(user),
        "created_at": {"$gte": from_date},
        "pnl": {"$ne": None}
    }).to_list(length=10000)
    
    if not trades:
        return {
            "total_trades": 0,
            "win_rate": 0,
            "total_pnl": 0,
            "avg_win": 0,
            "avg_loss": 0,
            "max_win": 0,
            "max_loss": 0,
            "profit_factor": 0,
            "sharpe_ratio": 0,
            "max_drawdown": 0,
            "daily_pnl": [],
        }
    
    wins = [float(t["pnl"]) for t in trades if float(t.get("pnl", 0)) > 0]
    losses = [float(t["pnl"]) for t in trades if float(t.get("pnl", 0)) < 0]
    
    total_pnl = sum(float(t.get("pnl", 0)) for t in trades)
    win_rate = len(wins) / len(trades) * 100 if trades else 0
    avg_win = sum(wins) / len(wins) if wins else 0
    avg_loss = sum(losses) / len(losses) if losses else 0
    max_win = max(wins) if wins else 0
    max_loss = min(losses) if losses else 0
    
    # Profit factor
    total_wins = sum(wins) if wins else 0
    total_losses = abs(sum(losses)) if losses else 0
    profit_factor = total_wins / total_losses if total_losses > 0 else 0
    
    # Calculate max drawdown
    cumulative_pnl = []
    running_total = 0
    for t in sorted(trades, key=lambda x: x["created_at"]):
        running_total += float(t.get("pnl", 0))
        cumulative_pnl.append(running_total)
    
    peak = cumulative_pnl[0] if cumulative_pnl else 0
    max_dd = 0
    for val in cumulative_pnl:
        if val > peak:
            peak = val
        dd = peak - val
        if dd > max_dd:
            max_dd = dd
    
    # Sharpe ratio (simplified)
    sharpe = 0
    if len(trades) > 1:
        returns = [float(t.get("pnl", 0)) for t in trades]
        avg_return = sum(returns) / len(returns)
        std_return = (sum((r - avg_return) ** 2 for r in returns) / len(returns)) ** 0.5
        sharpe = avg_return / std_return if std_return > 0 else 0
    
    # Daily P&L breakdown
    daily_pnl_map = {}
    for t in trades:
        date_key = t["created_at"].strftime("%Y-%m-%d")
        daily_pnl_map[date_key] = daily_pnl_map.get(date_key, 0) + float(t.get("pnl", 0))
    
    daily_pnl = [{"date": k, "pnl": round(v, 2)} for k, v in sorted(daily_pnl_map.items())]
    
    # Best and worst days
    best_day = max(daily_pnl, key=lambda x: x["pnl"]) if daily_pnl else {"date": "", "pnl": 0}
    worst_day = min(daily_pnl, key=lambda x: x["pnl"]) if daily_pnl else {"date": "", "pnl": 0}
    
    return {
        "total_trades": len(trades),
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "win_rate": round(win_rate, 2),
        "total_pnl": round(total_pnl, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "max_win": round(max_win, 2),
        "max_loss": round(max_loss, 2),
        "profit_factor": round(profit_factor, 2),
        "sharpe_ratio": round(sharpe, 2),
        "max_drawdown": round(max_dd, 2),
        "best_day": best_day,
        "worst_day": worst_day,
        "daily_pnl": daily_pnl,
        "period_days": days,
    }


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


@router.get("/news/stock/{instrument_key}")
async def stock_specific_news(
    instrument_key: str,
    hours: int = 48,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Get news specifically about a stock (filtered and verified)."""
    from app.core.config import get_settings
    from app.services.news_sentiment import COMPANY_NAMES, COMPANY_SEARCH_TERMS
    
    settings = get_settings()
    company_name = COMPANY_NAMES.get(instrument_key, instrument_key.split("|")[-1])
    
    # Build targeted query
    specific_query = f'"{company_name}" AND (stock OR shares OR market OR trading OR earnings OR profit OR revenue)'
    
    try:
        async with __import__('httpx').AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://newsdata.io/api/1/news",
                params={
                    "apikey": settings.news_api_key,
                    "q": specific_query,
                    "country": "in",
                    "language": "en",
                    "category": "business",
                },
            )
            r.raise_for_status()
            data = r.json()
        
        # Filter articles to ensure company name is in title or description
        articles = []
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        for a in data.get("results", []):
            title = a.get("title", "").lower()
            description = a.get("description", "").lower()
            company_lower = company_name.lower()
            
            # Verify company name appears in content
            if company_lower not in title and company_lower not in description:
                # Try alternative names
                if instrument_key in COMPANY_SEARCH_TERMS:
                    found = False
                    for alt_name in COMPANY_SEARCH_TERMS[instrument_key]:
                        if alt_name.lower() in title or alt_name.lower() in description:
                            found = True
                            break
                    if not found:
                        continue
                else:
                    continue
            
            # Check time window
            pub_date = a.get("pubDate", "")
            try:
                pub_dt = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                if pub_dt < cutoff:
                    continue
            except Exception:
                pass
            
            articles.append({
                "title": a.get("title", ""),
                "description": a.get("description") or "",
                "url": a.get("link", ""),
                "source": a.get("source_name") or a.get("source_id", ""),
                "published_at": pub_date,
                "image": a.get("image_url") or "",
            })
            
            if len(articles) >= 15:
                break
        
        return {"articles": articles, "company": company_name}
    
    except Exception as e:
        return {"articles": [], "company": company_name, "error": str(e)}


@router.get("/account/funds")
async def account_funds(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    """Get account funds from Upstox or calculate from portfolio."""
    user = await get_default_user(db)
    user_id = _user_id(user)
    
    # Check if manual balance is set
    manual_balance = await db["manual_balance"].find_one({"user_id": user_id})
    if manual_balance:
        return {
            "available_margin": float(manual_balance.get("balance", 0)),
            "used_margin": 0,
            "total_balance": float(manual_balance.get("balance", 0)),
            "source": "manual_entry",
            "updated_at": manual_balance.get("updated_at"),
            "note": "Manually entered balance. Use regular access_token for real-time data.",
        }
    
    upstox = UpstoxService(db)
    
    try:
        credential = await upstox.get_credential(user_id)
    except Exception as e:
        # No credentials stored - calculate from portfolio
        return await _calculate_portfolio_balance(db, user_id)
    
    try:
        async with __import__('httpx').AsyncClient(timeout=15) as c:
            r = await c.get(
                "https://api.upstox.com/v2/user/get-funds-and-margin",
                headers={"Authorization": f"Bearer {credential.access_token}", "Accept": "application/json"},
            )
            r.raise_for_status()
            data = r.json().get("data", {})
        
        equity = data.get("equity", {})
        
        # Return actual values including negative balances
        return {
            "available_margin": float(equity.get("available_margin", 0)),
            "used_margin": float(equity.get("used_margin", 0)),
            "payin_amount": float(equity.get("payin_amount", 0)),
            "notional_cash": float(equity.get("notional_cash", 0)),
            "source": "upstox_api",
        }
    except __import__('httpx').HTTPStatusError as e:
        # Extended token doesn't support funds API - calculate from portfolio
        if e.response.status_code == 401:
            error_data = e.response.json()
            error_msg = error_data.get('errors', [{}])[0].get('message', '')
            if 'not permitted with an extended_token' in error_msg.lower():
                return await _calculate_portfolio_balance(db, user_id)
        
        # Handle other errors
        if e.response.status_code == 423:
            try:
                error_data = e.response.json()
                error_msg = error_data.get('errors', [{}])[0].get('message', '')
                if 'service hours' in error_msg.lower() or 'accessible from' in error_msg.lower():
                    return await _calculate_portfolio_balance(db, user_id, 
                        error="Upstox Funds API available only from 5:30 AM to 12:00 AM IST")
            except:
                pass
        
        return await _calculate_portfolio_balance(db, user_id, 
            error=f"Upstox API error: {e.response.status_code}")
    except Exception as e:
        return await _calculate_portfolio_balance(db, user_id, 
            error="Unable to fetch from Upstox")


@router.post("/account/set-balance")
async def set_manual_balance(payload: dict, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    """Manually set account balance (workaround for extended_token limitation)."""
    user = await get_default_user(db)
    balance = float(payload.get("balance", 0))
    
    await db["manual_balance"].update_one(
        {"user_id": _user_id(user)},
        {"$set": {
            "user_id": _user_id(user),
            "balance": balance,
            "updated_at": datetime.utcnow(),
        }},
        upsert=True,
    )
    
    return {
        "success": True,
        "balance": balance,
        "message": "Manual balance set successfully",
        "note": "This is a workaround. For real-time balance, use regular access_token (not extended_token).",
    }


async def _calculate_portfolio_balance(db: AsyncIOMotorDatabase, user_id: str, error: str = None) -> dict:
    """Calculate balance from trades and positions in database."""
    # Get all trades
    trades = await db["trades"].find({"user_id": user_id}).to_list(length=10000)
    
    # Calculate realized P&L from closed trades
    realized_pnl = sum(float(t.get("pnl", 0)) for t in trades if t.get("pnl") is not None)
    
    # Get open positions
    positions = await db["positions"].find({"user_id": user_id, "quantity": {"$ne": 0}}).to_list(length=1000)
    
    # Calculate unrealized P&L (would need current prices for accurate calculation)
    # For now, just show the capital tied up in positions
    capital_in_positions = 0
    for pos in positions:
        qty = int(pos.get("quantity", 0))
        avg_price = float(pos.get("average_price", 0))
        capital_in_positions += abs(qty) * avg_price
    
    # Estimate available balance
    # Assuming starting capital (can be configured)
    starting_capital = 50000  # Default, should be configurable
    available_balance = starting_capital + realized_pnl - capital_in_positions
    
    result = {
        "available_margin": round(available_balance, 2),
        "used_margin": round(capital_in_positions, 2),
        "realized_pnl": round(realized_pnl, 2),
        "unrealized_pnl": 0,  # Would need current prices
        "total_balance": round(starting_capital + realized_pnl, 2),
        "source": "portfolio_calculation",
        "note": "Calculated from trade history. For real-time balance, use regular access_token (not extended_token).",
    }
    
    if error:
        result["upstox_error"] = error
    
    return result


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
