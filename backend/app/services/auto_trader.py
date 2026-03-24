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
from app.services.stock_scanner import StockScannerService
from app.services.upstox import UpstoxService

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None
_status: dict = {
    "running": False,
    "last_cycle": None,
    "last_error": None,
    "cycles": 0,
    "active_position": None,   # currently held stock
    "today_pnl": 0.0,
    "today_trades": 0,
    "log": [],                 # last 20 log lines shown in UI
    "win_rate": 0.0,
    "total_wins": 0,
    "total_losses": 0,
    "avg_win": 0.0,
    "avg_loss": 0.0,
    "max_drawdown": 0.0,
    "sharpe_ratio": 0.0,
    "trailing_stop_active": False,
    "trailing_stop_price": 0.0,
}

from app.models.watchlist import INTRADAY_UNIVERSE

WATCHLIST = INTRADAY_UNIVERSE  # Fallback watchlist

LABEL = {
    "NSE_EQ|INE002A01018": "RELIANCE",
    "NSE_EQ|INE467B01029": "TCS",
    "NSE_EQ|INE040A01034": "HDFCBANK",
    "NSE_EQ|INE009A01021": "INFY",
    "NSE_EQ|INE090A01021": "ICICIBANK",
    "NSE_EQ|INE062A01020": "SBIN",
    "NSE_EQ|INE397D01024": "BHARTIARTL",
    "NSE_EQ|INE154A01025": "ITC",
    "NSE_EQ|INE018A01030": "LT",
    "NSE_EQ|INE030A01027": "HINDUNILVR",
    "NSE_EQ|INE155A01022": "TATAMOTORS",
    "NSE_EQ|INE721A01013": "TATASTEEL",
    "NSE_EQ|INE019A01038": "AXISBANK",
    "NSE_EQ|INE238A01034": "KOTAK",
    "NSE_EQ|INE120A01034": "ASIANPAINT",
    "NSE_EQ|INE752E01010": "ADANIENT",
    "NSE_EQ|INE742F01042": "ADANIPORTS",
    "NSE_EQ|INE066A01021": "MARUTI",
    "NSE_EQ|INE101D01020": "MAHINDRA",
    "NSE_EQ|INE239A01016": "WIPRO",
}


def _log(msg: str) -> None:
    logger.info(msg)
    _status["log"] = ([{"t": datetime.now(timezone.utc).strftime("%H:%M:%S"), "msg": msg}] + _status["log"])[:20]


def _db():
    settings = get_settings()
    return get_client()[settings.mongodb_db]


def _score_stock(quote: dict, candles: list[dict]) -> float:
    """
    Score a stock 0-100 for trading opportunity.
    Higher = better candidate to trade right now.
    Uses: RSI, MACD crossover, momentum, volume surge, Bollinger position.
    """
    last = float(quote.get("last_price", 0))
    if last == 0 or len(candles) < 30:
        return 0.0

    try:
        df = pd.DataFrame(candles)
        df = add_technical_indicators(df)
        if df.empty:
            return 0.0

        row = df.iloc[-1]
        score = 0.0

        # RSI: best between 40-60 (active momentum, not overbought/oversold)
        rsi = float(row.get("rsi_14", 50))
        if 35 <= rsi <= 65:
            score += 25
        elif 30 <= rsi < 35 or 65 < rsi <= 70:
            score += 10

        # MACD crossover signal
        macd = float(row.get("macd", 0))
        macd_sig = float(row.get("macd_signal", 0))
        if abs(macd - macd_sig) < abs(macd) * 0.1:  # near crossover
            score += 20
        elif macd > macd_sig:
            score += 10

        # Intraday momentum (price vs open)
        open_ = float(quote.get("ohlc", {}).get("open", last))
        momentum_pct = (last - open_) / open_ * 100 if open_ > 0 else 0
        score += min(abs(momentum_pct) * 5, 25)  # up to 25 pts

        # Volume surge vs 20-day avg
        vol = float(quote.get("volume") or 0)
        vol_ma = float(row.get("volume_ma_20", 1) or 1)
        if vol > vol_ma * 1.5:
            score += 15
        elif vol > vol_ma:
            score += 7

        # Bollinger: price near middle band = good entry
        bb_high = float(row.get("bb_high", last * 1.02))
        bb_low = float(row.get("bb_low", last * 0.98))
        bb_range = bb_high - bb_low
        if bb_range > 0:
            bb_pos = (last - bb_low) / bb_range
            if 0.3 <= bb_pos <= 0.7:
                score += 15

        return min(score, 100.0)
    except Exception:
        return 0.0


def _trade_signal(quote: dict, candles: list[dict]) -> str | None:
    """BUY / SELL / None based on indicators."""
    last = float(quote.get("last_price", 0))
    if last == 0 or len(candles) < 30:
        return None
    try:
        df = pd.DataFrame(candles)
        df = add_technical_indicators(df)
        if df.empty:
            return None
        row = df.iloc[-1]
        rsi = float(row.get("rsi_14", 50))
        macd = float(row.get("macd", 0))
        macd_sig = float(row.get("macd_signal", 0))
        open_ = float(quote.get("ohlc", {}).get("open", last))
        momentum = (last - open_) / open_ * 100 if open_ > 0 else 0

        # BUY: RSI not overbought + MACD bullish + positive momentum
        if rsi < 65 and macd > macd_sig and momentum > 0.2:
            return "BUY"
        # SELL signal for shorting: RSI not oversold + MACD bearish + negative momentum
        if rsi > 35 and macd < macd_sig and momentum < -0.2:
            return "SELL"
        return None
    except Exception:
        return None


async def _fetch_candles_for_scoring(upstox: UpstoxService, credential: Any, instrument_key: str, interval: str = "day") -> list[dict]:
    """Fetch stored candles or load from Upstox for scoring."""
    from app.services.market_data import MarketDataService
    db = _db()
    svc = MarketDataService(db)
    candles = await svc.recent_candles(instrument_key, interval, limit=60)
    if len(candles) < 30:
        try:
            today = datetime.now(timezone.utc).date().isoformat()
            if interval == "day":
                from_date = datetime.now(timezone.utc).replace(year=datetime.now().year - 1).date().isoformat()
            else:
                # For intraday, only fetch today's data
                from_date = today
            data = await upstox.get_historical_candles(credential.access_token, instrument_key, interval, today, from_date)
            rows = data.get("data", {}).get("candles", [])
            await svc.persist_candles(instrument_key, interval, rows)
            candles = await svc.recent_candles(instrument_key, interval, limit=60)
        except Exception as e:
            logger.warning("Could not load candles for %s: %s", instrument_key, e)
    return [
        {"open": float(c.open), "high": float(c.high), "low": float(c.low),
         "close": float(c.close), "volume": c.volume}
        for c in candles
    ]


async def _place_order(upstox: UpstoxService, credential: Any, instrument_key: str,
                       side: str, quantity: int, paper_trading: bool) -> dict:
    payload = {
        "quantity": quantity, "product": "I", "validity": "DAY",
        "price": 0, "tag": "benx-auto", "instrument_token": instrument_key,
        "order_type": "MARKET", "transaction_type": side,
        "disclosed_quantity": 0, "trigger_price": 0, "is_amo": False,
    }
    if paper_trading:
        return {"status": "paper_filled", "data": {"order_id": f"paper-{instrument_key}-{side}"}, "_payload": payload}
    resp = await upstox.place_order(credential.access_token, payload)
    resp["_payload"] = payload
    return resp


async def _calculate_performance_metrics(db, user_id: str) -> None:
    """Calculate and update performance metrics."""
    trades = await db["trades"].find({"user_id": user_id, "pnl": {"$ne": None}}).to_list(length=10000)
    if not trades:
        return
    
    wins = [float(t["pnl"]) for t in trades if float(t.get("pnl", 0)) > 0]
    losses = [float(t["pnl"]) for t in trades if float(t.get("pnl", 0)) < 0]
    
    _status["total_wins"] = len(wins)
    _status["total_losses"] = len(losses)
    _status["win_rate"] = round(len(wins) / len(trades) * 100, 2) if trades else 0.0
    _status["avg_win"] = round(sum(wins) / len(wins), 2) if wins else 0.0
    _status["avg_loss"] = round(sum(losses) / len(losses), 2) if losses else 0.0
    
    # Calculate max drawdown
    cumulative_pnl = []
    running_total = 0
    for t in sorted(trades, key=lambda x: x["created_at"]):
        running_total += float(t.get("pnl", 0))
        cumulative_pnl.append(running_total)
    
    if cumulative_pnl:
        peak = cumulative_pnl[0]
        max_dd = 0
        for val in cumulative_pnl:
            if val > peak:
                peak = val
            dd = peak - val
            if dd > max_dd:
                max_dd = dd
        _status["max_drawdown"] = round(max_dd, 2)
    
    # Calculate Sharpe ratio (simplified)
    if len(trades) > 1:
        returns = [float(t.get("pnl", 0)) for t in trades]
        avg_return = sum(returns) / len(returns)
        std_return = (sum((r - avg_return) ** 2 for r in returns) / len(returns)) ** 0.5
        _status["sharpe_ratio"] = round(avg_return / std_return if std_return > 0 else 0, 2)


async def _run_cycle(db, state: dict) -> None:
    user_id = state["user_id"]
    capital = float(state.get("max_capital_allocation", 50000))
    daily_loss_limit = float(state.get("daily_loss_limit", 2000))
    paper_trading = bool(state.get("paper_trading", True))
    profit_target_pct = float(state.get("profit_target_pct", 1.5))   # default 1.5%
    stop_loss_pct = float(state.get("stop_loss_pct", 0.75))          # default 0.75%
    trailing_stop_enabled = bool(state.get("trailing_stop_enabled", True))
    trailing_stop_pct = float(state.get("trailing_stop_pct", 0.5))  # default 0.5%
    max_positions = int(state.get("max_positions", 3))               # default 3 concurrent positions
    risk_per_trade_pct = float(state.get("risk_per_trade_pct", 2.0)) # default 2% of capital per trade

    upstox = UpstoxService(db)
    credential = await upstox.get_credential(user_id)
    alerts = AlertService()

    # --- Calculate performance metrics ---
    await _calculate_performance_metrics(db, user_id)
    
    # --- Check daily loss limit ---
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_trades = await db["trades"].find({"user_id": user_id, "created_at": {"$gte": today}}).to_list(length=10000)
    today_pnl = sum(float(t.get("pnl") or 0) for t in today_trades)
    _status["today_pnl"] = today_pnl
    _status["today_trades"] = len(today_trades)
    
    # Check max trades per day limit
    max_trades_per_day = int(state.get("max_trades_per_day", 10))
    if len(today_trades) >= max_trades_per_day:
        _log(f"Max trades per day ({max_trades_per_day}) reached. Waiting for next day.")
        return

    if daily_loss_limit > 0 and today_pnl <= -daily_loss_limit:
        _log(f"Daily loss limit ₹{daily_loss_limit} hit (P&L: ₹{today_pnl:.2f}). Stopping.")
        await db["auto_trading_state"].update_one({"user_id": user_id}, {"$set": {"enabled": False}})
        alerts.publish("risk.warning", {"message": f"Daily loss limit hit. Auto-trading disabled."})
        stop_auto_trader()
        return

    # --- Check existing open positions: manage them ---
    open_positions = await db["positions"].find({"user_id": user_id, "quantity": {"$ne": 0}}).to_list(length=100)
    
    for open_pos in open_positions:
        instrument_key = open_pos["instrument_key"]
        entry_price = float(open_pos.get("average_price", 0))
        qty = int(open_pos.get("quantity", 0))

        # Fetch current price
        quotes_resp = await upstox.get_quotes(credential.access_token, [instrument_key])
        quote = (quotes_resp.get("data") or {}).get(instrument_key) or {}
        current_price = float(quote.get("last_price") or entry_price)

        if entry_price > 0 and qty != 0:
            pnl_pct = ((current_price - entry_price) / entry_price * 100) * (1 if qty > 0 else -1)
            pnl_abs = (current_price - entry_price) * abs(qty) * (1 if qty > 0 else -1)
            label = LABEL.get(instrument_key, instrument_key)

            _log(f"Monitoring {label} | Entry ₹{entry_price:.2f} | Now ₹{current_price:.2f} | P&L ₹{pnl_abs:.2f} ({pnl_pct:.2f}%)")
            
            # Update active position status (for first position)
            if not _status["active_position"]:
                _status["active_position"] = {
                    "instrument": label, "entry": entry_price,
                    "current": current_price, "qty": qty,
                    "pnl": round(pnl_abs, 2), "pnl_pct": round(pnl_pct, 2),
                }

            should_exit = False
            exit_reason = ""
            
            # Trailing stop logic
            if trailing_stop_enabled and pnl_pct > 0:
                position_key = f"{user_id}_{instrument_key}"
                trailing_stop_price = _status.get(f"trailing_stop_{position_key}", 0)
                
                # Initialize or update trailing stop
                if qty > 0:  # Long position
                    new_trailing_stop = current_price * (1 - trailing_stop_pct / 100)
                    if new_trailing_stop > trailing_stop_price:
                        _status[f"trailing_stop_{position_key}"] = new_trailing_stop
                        trailing_stop_price = new_trailing_stop
                        _log(f"Trailing stop updated for {label}: ₹{trailing_stop_price:.2f}")
                    
                    if current_price <= trailing_stop_price and trailing_stop_price > 0:
                        should_exit = True
                        exit_reason = f"Trailing stop triggered at ₹{trailing_stop_price:.2f}"
                        _status["trailing_stop_active"] = True
                else:  # Short position
                    new_trailing_stop = current_price * (1 + trailing_stop_pct / 100)
                    if trailing_stop_price == 0 or new_trailing_stop < trailing_stop_price:
                        _status[f"trailing_stop_{position_key}"] = new_trailing_stop
                        trailing_stop_price = new_trailing_stop
                        _log(f"Trailing stop updated for {label}: ₹{trailing_stop_price:.2f}")
                    
                    if current_price >= trailing_stop_price and trailing_stop_price > 0:
                        should_exit = True
                        exit_reason = f"Trailing stop triggered at ₹{trailing_stop_price:.2f}"
                        _status["trailing_stop_active"] = True
            
            # Standard profit target and stop loss
            if not should_exit:
                if pnl_pct >= profit_target_pct:
                    should_exit = True
                    exit_reason = f"Profit target {profit_target_pct}% hit"
                elif pnl_pct <= -stop_loss_pct:
                    should_exit = True
                    exit_reason = f"Stop-loss {stop_loss_pct}% hit"

            if should_exit:
                exit_side = "SELL" if qty > 0 else "BUY"
                try:
                    resp = await _place_order(upstox, credential, instrument_key, exit_side, abs(qty), paper_trading)
                    await db["trades"].insert_one({
                        "user_id": user_id, "strategy_name": "auto-exit",
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
                    # Clear trailing stop for this position
                    position_key = f"{user_id}_{instrument_key}"
                    _status.pop(f"trailing_stop_{position_key}", None)
                    _status["trailing_stop_active"] = False
                    
                    if not open_positions or instrument_key == open_positions[0]["instrument_key"]:
                        _status["active_position"] = None
                    
                    _log(f"EXIT {label} @ ₹{current_price:.2f} | {exit_reason} | P&L ₹{pnl_abs:.2f}")
                    alerts.publish("trade.executed", {"instrument_key": instrument_key, "side": exit_side,
                                                       "pnl": pnl_abs, "reason": exit_reason})
                except Exception as exc:
                    _log(f"Exit order failed for {label}: {exc}")
    
    # Check if we can open new positions
    if len(open_positions) >= max_positions:
        _log(f"Max positions ({max_positions}) reached. Managing existing positions only.")
        return

    # --- Scan universe for best stocks ---
    if not open_positions:
        _status["active_position"] = None
    _log(f"Scanning stock universe for best opportunities... ({len(open_positions)}/{max_positions} positions)")

    # Use stock scanner to get top 5 stocks
    scanner = StockScannerService(db)
    try:
        top_stocks = await scanner.scan_universe(interval="5minute", min_candles=60, top_n=5)
        _log(f"Scanner found {len(top_stocks)} candidates")
    except Exception as exc:
        _log(f"Scanner failed: {exc}. Falling back to watchlist.")
        top_stocks = []

    # If scanner returns results, use them; otherwise fall back to old logic
    if top_stocks:
        # Pick the top stock with BUY or SELL signal
        chosen = None
        for stock in top_stocks:
            instrument_key = stock["symbol"]
            ml_signal = stock["ml_signal"]
            
            if ml_signal in ["BUY", "SELL"]:
                # Fetch current price
                quotes_resp = await upstox.get_quotes(credential.access_token, [instrument_key])
                quote = (quotes_resp.get("data") or {}).get(instrument_key) or {}
                last_price = float(quote.get("last_price") or 0)
                
                if last_price > 0 and last_price <= capital * 0.5:
                    chosen = (instrument_key, ml_signal, last_price, stock["intraday_score"])
                    break
        
        if chosen:
            instrument_key, signal, last_price, score = chosen
            label = LABEL.get(instrument_key, instrument_key.split("|")[-1])
            
            # Advanced position sizing based on risk
            # Risk per trade = capital * risk_per_trade_pct / 100
            # Position size = risk_amount / (entry_price * stop_loss_pct / 100)
            risk_amount = capital * (risk_per_trade_pct / 100)
            stop_distance = last_price * (stop_loss_pct / 100)
            quantity = max(int(risk_amount / stop_distance), 1)
            
            # Cap at 20% of capital per position
            max_per_trade = capital * 0.2
            max_qty = int(max_per_trade / last_price)
            quantity = min(quantity, max_qty)
            
            cost = quantity * last_price
            
            _log(f"BEST: {label} | Score: {score:.2f} | Signal: {signal} | ₹{last_price:.2f} x {quantity} = ₹{cost:.2f}")
            
            try:
                resp = await _place_order(upstox, credential, instrument_key, signal, quantity, paper_trading)
                await db["trades"].insert_one({
                    "user_id": user_id, "strategy_name": "auto-scanner",
                    "instrument_key": instrument_key, "side": signal,
                    "quantity": quantity, "price": last_price,
                    "status": resp.get("status", "submitted"),
                    "upstox_order_id": resp.get("data", {}).get("order_id"),
                    "pnl": None, "metadata_json": resp.get("_payload"),
                    "created_at": datetime.now(timezone.utc),
                })
                signed_qty = quantity if signal == "BUY" else -quantity
                await db["positions"].update_one(
                    {"user_id": user_id, "instrument_key": instrument_key},
                    {"$set": {"quantity": signed_qty, "average_price": last_price,
                              "last_price": last_price, "updated_at": datetime.now(timezone.utc)}},
                    upsert=True,
                )
                _status["active_position"] = {"instrument": label, "entry": last_price, "current": last_price,
                                               "qty": signed_qty, "pnl": 0.0, "pnl_pct": 0.0}
                _log(f"ENTRY {signal} {label} x{quantity} @ ₹{last_price:.2f} [{'PAPER' if paper_trading else 'LIVE'}]")
                alerts.publish("trade.executed", {"instrument_key": instrument_key, "side": signal,
                                                   "quantity": quantity, "price": last_price, "paper": paper_trading})
                return
            except Exception as exc:
                _log(f"Entry order failed for {label}: {exc}")
                return
    
    # Fallback to old watchlist logic if scanner didn't find anything
    _log("No scanner results. Using watchlist fallback...")

    quotes_resp = await upstox.get_quotes(credential.access_token, WATCHLIST)
    quotes: dict = quotes_resp.get("data") or {}

    scores: list[tuple[str, float, str | None, float]] = []
    for instrument_key in WATCHLIST:
        quote = quotes.get(instrument_key) or {}
        last_price = float(quote.get("last_price") or 0)
        if last_price == 0:
            continue
        # Only trade stocks we can afford at least 1 share with 10% of capital
        if last_price > capital * 0.5:
            continue
        candles = await _fetch_candles_for_scoring(upstox, credential, instrument_key)
        score = _score_stock(quote, candles)
        signal = _trade_signal(quote, candles)
        scores.append((instrument_key, score, signal, last_price))
        _log(f"  {LABEL.get(instrument_key, instrument_key)}: score={score:.1f} signal={signal}")

    # Pick highest scoring stock that has a clear signal
    scores.sort(key=lambda x: x[1], reverse=True)
    chosen = next(((k, sig, price) for k, score, sig, price in scores if sig is not None and score >= 40), None)

    if chosen is None:
        _log("No strong opportunity found this cycle. Waiting...")
        return

    instrument_key, signal, last_price = chosen
    label = LABEL.get(instrument_key, instrument_key)

    # Advanced position sizing based on risk
    risk_amount = capital * (risk_per_trade_pct / 100)
    stop_distance = last_price * (stop_loss_pct / 100)
    quantity = max(int(risk_amount / stop_distance), 1)
    
    # Cap at 20% of capital per position
    max_per_trade = capital * 0.2
    max_qty = int(max_per_trade / last_price)
    quantity = min(quantity, max_qty)
    
    cost = quantity * last_price

    _log(f"BEST: {label} | Score: {scores[0][1]:.1f} | Signal: {signal} | ₹{last_price:.2f} x {quantity} = ₹{cost:.2f}")

    try:
        resp = await _place_order(upstox, credential, instrument_key, signal, quantity, paper_trading)
        await db["trades"].insert_one({
            "user_id": user_id, "strategy_name": "auto-entry",
            "instrument_key": instrument_key, "side": signal,
            "quantity": quantity, "price": last_price,
            "status": resp.get("status", "submitted"),
            "upstox_order_id": resp.get("data", {}).get("order_id"),
            "pnl": None, "metadata_json": resp.get("_payload"),
            "created_at": datetime.now(timezone.utc),
        })
        signed_qty = quantity if signal == "BUY" else -quantity
        await db["positions"].update_one(
            {"user_id": user_id, "instrument_key": instrument_key},
            {"$set": {"quantity": signed_qty, "average_price": last_price,
                      "last_price": last_price, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        _status["active_position"] = {"instrument": label, "entry": last_price, "current": last_price,
                                       "qty": signed_qty, "pnl": 0.0, "pnl_pct": 0.0}
        _log(f"ENTRY {signal} {label} x{quantity} @ ₹{last_price:.2f} [{'PAPER' if paper_trading else 'LIVE'}]")
        alerts.publish("trade.executed", {"instrument_key": instrument_key, "side": signal,
                                           "quantity": quantity, "price": last_price, "paper": paper_trading})
    except Exception as exc:
        _log(f"Entry order failed for {label}: {exc}")


async def _loop(interval_seconds: int = 30) -> None:
    global _status
    db = _db()
    _status["running"] = True
    _log(f"Auto-trader started (cycle every {interval_seconds}s)")
    while True:
        try:
            state = await db["auto_trading_state"].find_one({"enabled": True})
            if state is None:
                await asyncio.sleep(interval_seconds)
                continue
            await _run_cycle(db, state)
            _status["cycles"] += 1
            _status["last_cycle"] = datetime.now(timezone.utc).isoformat()
            _status["last_error"] = None
        except Exception as exc:
            _status["last_error"] = str(exc)
            logger.exception("Auto-trader cycle error: %s", exc)
        await asyncio.sleep(interval_seconds)


def get_status() -> dict:
    return _status


def start_auto_trader(interval_seconds: int = 30) -> None:
    global _task
    if _task is not None and not _task.done():
        return
    _task = asyncio.get_event_loop().create_task(_loop(interval_seconds))
    logger.info("Auto-trader task created")


def stop_auto_trader() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
        _task = None
    _status["running"] = False
    _log("Auto-trader stopped")
