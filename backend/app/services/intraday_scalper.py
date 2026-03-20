from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.core.config import get_settings
from app.db.session import get_client
from app.services.alerts import AlertService
from app.services.indicators import add_technical_indicators
from app.services.upstox import UpstoxService

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None
_status: dict = {
    "running": False,
    "last_cycle": None,
    "last_error": None,
    "cycles": 0,
    "active_position": None,
    "today_pnl": 0.0,
    "today_trades": 0,
    "log": [],
}

WATCHLIST = [
    "NSE_EQ|INE002A01018",  # RELIANCE
    "NSE_EQ|INE467B01029",  # TCS
    "NSE_EQ|INE040A01034",  # HDFCBANK
    "NSE_EQ|INE009A01021",  # INFY
    "NSE_EQ|INE090A01021",  # ICICIBANK
    "NSE_EQ|INE155A01022",  # TATAMOTORS
    "NSE_EQ|INE192A01025",  # TATAPOWER
    "NSE_EQ|INE081A01020",  # TATACHEM
    "NSE_EQ|INE245A01021",  # TATACOMM
    "NSE_EQ|INE721A01013",  # TATASTEEL
]

LABEL = {
    "NSE_EQ|INE002A01018": "RELIANCE",
    "NSE_EQ|INE467B01029": "TCS",
    "NSE_EQ|INE040A01034": "HDFCBANK",
    "NSE_EQ|INE009A01021": "INFY",
    "NSE_EQ|INE090A01021": "ICICIBANK",
    "NSE_EQ|INE155A01022": "TATAMOTORS",
    "NSE_EQ|INE192A01025": "TATAPOWER",
    "NSE_EQ|INE081A01020": "TATACHEM",
    "NSE_EQ|INE245A01021": "TATACOMM",
    "NSE_EQ|INE721A01013": "TATASTEEL",
}


def _log(msg: str) -> None:
    logger.info(msg)
    _status["log"] = ([{"t": datetime.now(timezone.utc).strftime("%H:%M:%S"), "msg": msg}] + _status["log"])[:20]


def _db():
    settings = get_settings()
    return get_client()[settings.mongodb_db]


def _scalping_signal(candles: list[dict], current_price: float) -> str | None:
    """
    Scalping signal based on 1-minute momentum and RSI.
    BUY: RSI < 40 and price rising
    SELL: RSI > 60 and price falling
    """
    if len(candles) < 15:
        return None
    
    try:
        df = pd.DataFrame(candles)
        df = add_technical_indicators(df)
        if df.empty:
            return None
        
        row = df.iloc[-1]
        prev_row = df.iloc[-2]
        
        rsi = float(row.get("rsi_14", 50))
        prev_close = float(prev_row.get("close", current_price))
        
        # Price momentum
        momentum = ((current_price - prev_close) / prev_close) * 100
        
        # BUY signal: RSI oversold + upward momentum
        if rsi < 40 and momentum > 0.05:
            return "BUY"
        
        # SELL signal: RSI overbought + downward momentum
        if rsi > 60 and momentum < -0.05:
            return "SELL"
        
        return None
    except Exception:
        return None


async def _fetch_intraday_candles(upstox: UpstoxService, credential: Any, instrument_key: str, interval: str) -> list[dict]:
    """Fetch intraday candles for scalping."""
    from app.services.market_data import MarketDataService
    db = _db()
    svc = MarketDataService(db)
    
    # Try to get from DB first
    candles = await svc.recent_candles(instrument_key, interval, limit=30)
    
    # If not enough, fetch from Upstox
    if len(candles) < 15:
        try:
            today = datetime.now(timezone.utc).date().isoformat()
            data = await upstox.get_historical_candles(credential.access_token, instrument_key, interval, today, today)
            rows = data.get("data", {}).get("candles", [])
            await svc.persist_candles(instrument_key, interval, rows)
            candles = await svc.recent_candles(instrument_key, interval, limit=30)
        except Exception as e:
            logger.warning("Could not load intraday candles for %s: %s", instrument_key, e)
    
    return [
        {"open": float(c.open), "high": float(c.high), "low": float(c.low),
         "close": float(c.close), "volume": c.volume}
        for c in candles
    ]


async def _place_order(upstox: UpstoxService, credential: Any, instrument_key: str,
                       side: str, quantity: int, paper_trading: bool) -> dict:
    payload = {
        "quantity": quantity, "product": "I", "validity": "DAY",
        "price": 0, "tag": "benx-scalp", "instrument_token": instrument_key,
        "order_type": "MARKET", "transaction_type": side,
        "disclosed_quantity": 0, "trigger_price": 0, "is_amo": False,
    }
    if paper_trading:
        return {"status": "paper_filled", "data": {"order_id": f"paper-{instrument_key}-{side}"}, "_payload": payload}
    resp = await upstox.place_order(credential.access_token, payload)
    resp["_payload"] = payload
    return resp


async def _run_scalping_cycle(db, state: dict) -> None:
    """
    Scalping cycle:
    1. Check if position exists
    2. If yes, check if 1 minute passed -> EXIT (profit or loss)
    3. If no, find best stock and ENTER
    """
    user_id = state["user_id"]
    capital = float(state.get("max_capital_allocation", 50000))
    daily_loss_limit = float(state.get("daily_loss_limit", 2000))
    paper_trading = bool(state.get("paper_trading", True))
    interval = state.get("scalping_interval", "1minute")  # 1minute, 5minute
    target_stock = state.get("stock")  # Specific stock to trade
    
    upstox = UpstoxService(db)
    credential = await upstox.get_credential(user_id)
    alerts = AlertService()

    # Check daily loss limit
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_trades = await db["trades"].find({"user_id": user_id, "created_at": {"$gte": today}}).to_list(length=10000)
    today_pnl = sum(float(t.get("pnl") or 0) for t in today_trades)
    _status["today_pnl"] = today_pnl
    _status["today_trades"] = len(today_trades)

    if daily_loss_limit > 0 and today_pnl <= -daily_loss_limit:
        _log(f"Daily loss limit ₹{daily_loss_limit} hit. Stopping scalping.")
        await db["intraday_scalping_state"].update_one({"user_id": user_id}, {"$set": {"enabled": False}})
        stop_scalping_bot()
        return

    # Check existing position
    open_pos = await db["positions"].find_one({"user_id": user_id, "quantity": {"$ne": 0}})
    
    if open_pos:
        instrument_key = open_pos["instrument_key"]
        entry_price = float(open_pos.get("average_price", 0))
        entry_time = open_pos.get("entry_time")
        qty = int(open_pos.get("quantity", 0))
        
        # Get current price
        quotes_resp = await upstox.get_quotes(credential.access_token, [instrument_key])
        quote = (quotes_resp.get("data") or {}).get(instrument_key) or {}
        current_price = float(quote.get("last_price") or entry_price)
        
        # Calculate time in position
        if entry_time:
            time_in_position = (datetime.now(timezone.utc) - entry_time).total_seconds()
        else:
            time_in_position = 0
        
        # Exit conditions:
        # 1. Time-based: Exit after interval duration (1 min = 60s, 5 min = 300s)
        interval_seconds = 60 if interval == "1minute" else 300 if interval == "5minute" else 900
        should_exit = time_in_position >= interval_seconds
        
        # 2. Stop-loss: Exit if loss > 0.5%
        pnl_pct = ((current_price - entry_price) / entry_price * 100) * (1 if qty > 0 else -1)
        if pnl_pct <= -0.5:
            should_exit = True
        
        # 3. Take-profit: Exit if profit > 0.3%
        if pnl_pct >= 0.3:
            should_exit = True
        
        if should_exit:
            exit_side = "SELL" if qty > 0 else "BUY"
            pnl_abs = (current_price - entry_price) * abs(qty) * (1 if qty > 0 else -1)
            label = LABEL.get(instrument_key, instrument_key)
            
            try:
                resp = await _place_order(upstox, credential, instrument_key, exit_side, abs(qty), paper_trading)
                await db["trades"].insert_one({
                    "user_id": user_id, "strategy_name": "scalping-exit",
                    "instrument_key": instrument_key, "side": exit_side,
                    "quantity": abs(qty), "price": current_price,
                    "status": resp.get("status", "submitted"),
                    "upstox_order_id": resp.get("data", {}).get("order_id"),
                    "pnl": pnl_abs, "metadata_json": resp.get("_payload"),
                    "created_at": datetime.now(timezone.utc),
                })
                await db["positions"].update_one(
                    {"user_id": user_id, "instrument_key": instrument_key},
                    {"$set": {"quantity": 0, "last_price": current_price, "updated_at": datetime.now(timezone.utc)}},
                )
                _status["active_position"] = None
                _log(f"EXIT {label} @ ₹{current_price:.2f} | P&L ₹{pnl_abs:.2f} ({pnl_pct:.2f}%) | Time: {time_in_position:.0f}s")
                alerts.publish("trade.executed", {"instrument_key": instrument_key, "side": exit_side, "pnl": pnl_abs})
            except Exception as exc:
                _log(f"Exit order failed for {label}: {exc}")
            return

    # No position: Find best stock and enter
    _status["active_position"] = None
    _log(f"Scanning for {interval} scalping opportunity...")
    
    # If specific stock selected, only trade that stock
    stocks_to_scan = [target_stock] if target_stock else WATCHLIST
    
    quotes_resp = await upstox.get_quotes(credential.access_token, stocks_to_scan)
    quotes: dict = quotes_resp.get("data") or {}
    
    best_stock = None
    best_signal = None
    best_price = 0
    
    for instrument_key in stocks_to_scan:
        quote = quotes.get(instrument_key) or {}
        last_price = float(quote.get("last_price") or 0)
        if last_price == 0 or last_price > capital * 0.3:
            continue
        
        candles = await _fetch_intraday_candles(upstox, credential, instrument_key, interval)
        signal = _scalping_signal(candles, last_price)
        
        if signal:
            best_stock = instrument_key
            best_signal = signal
            best_price = last_price
            break  # Take first signal
    
    if not best_stock:
        _log("No scalping signal found. Waiting...")
        return
    
    label = LABEL.get(best_stock, best_stock)
    quantity = max(int((capital * 0.2) / best_price), 1)
    
    _log(f"ENTRY {best_signal} {label} x{quantity} @ ₹{best_price:.2f}")
    
    try:
        resp = await _place_order(upstox, credential, best_stock, best_signal, quantity, paper_trading)
        await db["trades"].insert_one({
            "user_id": user_id, "strategy_name": "scalping-entry",
            "instrument_key": best_stock, "side": best_signal,
            "quantity": quantity, "price": best_price,
            "status": resp.get("status", "submitted"),
            "upstox_order_id": resp.get("data", {}).get("order_id"),
            "pnl": None, "metadata_json": resp.get("_payload"),
            "created_at": datetime.now(timezone.utc),
        })
        signed_qty = quantity if best_signal == "BUY" else -quantity
        await db["positions"].update_one(
            {"user_id": user_id, "instrument_key": best_stock},
            {"$set": {
                "quantity": signed_qty, "average_price": best_price,
                "last_price": best_price, "entry_time": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }},
            upsert=True,
        )
        _status["active_position"] = {
            "instrument": label, "entry": best_price, "current": best_price,
            "qty": signed_qty, "pnl": 0.0, "pnl_pct": 0.0,
        }
        alerts.publish("trade.executed", {"instrument_key": best_stock, "side": best_signal, "quantity": quantity})
    except Exception as exc:
        _log(f"Entry order failed for {label}: {exc}")


async def _scalping_loop(interval_seconds: int = 10) -> None:
    """Run scalping bot every 10 seconds."""
    global _status
    db = _db()
    _status["running"] = True
    _log(f"Scalping bot started (cycle every {interval_seconds}s)")
    
    while True:
        try:
            state = await db["intraday_scalping_state"].find_one({"enabled": True})
            if state is None:
                await asyncio.sleep(interval_seconds)
                continue
            
            await _run_scalping_cycle(db, state)
            _status["cycles"] += 1
            _status["last_cycle"] = datetime.now(timezone.utc).isoformat()
            _status["last_error"] = None
        except Exception as exc:
            _status["last_error"] = str(exc)
            logger.exception("Scalping cycle error: %s", exc)
        
        await asyncio.sleep(interval_seconds)


def get_scalping_status() -> dict:
    return _status


def start_scalping_bot(interval_seconds: int = 10) -> None:
    global _task
    if _task is not None and not _task.done():
        return
    _task = asyncio.get_event_loop().create_task(_scalping_loop(interval_seconds))
    logger.info("Scalping bot task created")


def stop_scalping_bot() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
        _task = None
    _status["running"] = False
    _log("Scalping bot stopped")
