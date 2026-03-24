"""
Professional Auto Trading System with Detailed Decision Logging
Designed for educational demonstration and teacher presentation
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from decimal import Decimal

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
    "active_positions": [],
    "today_pnl": 0.0,
    "today_trades": 0,
    "log": [],
    "decision_log": [],  # Detailed decision explanations
    "performance_metrics": {},
    "current_scan_results": [],
}

STOCK_LABELS = {
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
}


def _log(msg: str, level: str = "INFO") -> None:
    """Add log entry with timestamp and level."""
    logger.info(msg)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "level": level,
        "message": msg
    }
    _status["log"] = ([entry] + _status["log"])[:50]  # Keep last 50 logs


def _log_decision(decision_type: str, stock: str, details: dict) -> None:
    """Log detailed decision with reasoning for educational purposes."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "type": decision_type,
        "stock": stock,
        "details": details
    }
    _status["decision_log"] = ([entry] + _status["decision_log"])[:100]  # Keep last 100 decisions


def _db():
    settings = get_settings()
    return get_client()[settings.mongodb_db]


async def _analyze_stock_comprehensive(
    instrument_key: str,
    quote: dict,
    candles: list[dict],
    capital: float
) -> dict:
    """
    Comprehensive stock analysis with detailed scoring breakdown.
    Returns complete analysis for educational demonstration.
    """
    last_price = float(quote.get("last_price", 0))
    label = STOCK_LABELS.get(instrument_key, instrument_key.split("|")[-1])
    
    if last_price == 0 or len(candles) < 30:
        return {
            "instrument_key": instrument_key,
            "label": label,
            "viable": False,
            "reason": "Insufficient data or invalid price"
        }
    
    # Check affordability
    if last_price > capital * 0.5:
        return {
            "instrument_key": instrument_key,
            "label": label,
            "viable": False,
            "reason": f"Price ₹{last_price:.2f} too high for capital ₹{capital:.2f}"
        }
    
    try:
        df = pd.DataFrame(candles)
        df = add_technical_indicators(df)
        if df.empty:
            return {"instrument_key": instrument_key, "label": label, "viable": False, "reason": "Technical indicators failed"}
        
        row = df.iloc[-1]
        prev_row = df.iloc[-2] if len(df) > 1 else row
        
        # Extract all indicators
        rsi_14 = float(row.get("rsi_14", 50))
        rsi_7 = float(row.get("rsi_7", 50))
        macd = float(row.get("macd", 0))
        macd_signal = float(row.get("macd_signal", 0))
        macd_prev = float(prev_row.get("macd", 0))
        macd_signal_prev = float(prev_row.get("macd_signal", 0))
        
        sma_20 = float(row.get("sma_20", last_price))
        sma_50 = float(row.get("sma_50", last_price))
        ema_20 = float(row.get("ema_20", last_price))
        
        bb_high = float(row.get("bb_high", last_price * 1.02))
        bb_low = float(row.get("bb_low", last_price * 0.98))
        bb_position = (last_price - bb_low) / (bb_high - bb_low) if (bb_high - bb_low) > 0 else 0.5
        
        atr = float(row.get("atr_14", last_price * 0.02))
        adx = float(row.get("adx_14", 0))
        
        volume = float(quote.get("volume", 0))
        volume_ma = float(row.get("volume_ma_20", 1))
        volume_ratio = volume / volume_ma if volume_ma > 0 else 1
        
        open_price = float(quote.get("ohlc", {}).get("open", last_price))
        momentum_pct = ((last_price - open_price) / open_price * 100) if open_price > 0 else 0
        
        # Scoring breakdown
        score_breakdown = {}
        total_score = 0
        
        # 1. RSI Analysis (0-25 points)
        if 35 <= rsi_14 <= 65:
            rsi_score = 25
            rsi_status = "Optimal range (35-65) - Active momentum"
        elif 30 <= rsi_14 < 35 or 65 < rsi_14 <= 70:
            rsi_score = 15
            rsi_status = "Acceptable range - Moderate momentum"
        elif rsi_14 < 30:
            rsi_score = 5
            rsi_status = "Oversold - Potential reversal"
        elif rsi_14 > 70:
            rsi_score = 5
            rsi_status = "Overbought - Potential reversal"
        else:
            rsi_score = 10
            rsi_status = "Neutral"
        
        score_breakdown["rsi"] = {
            "score": rsi_score,
            "rsi_14": round(rsi_14, 2),
            "rsi_7": round(rsi_7, 2),
            "status": rsi_status
        }
        total_score += rsi_score
        
        # 2. MACD Analysis (0-25 points)
        macd_crossover = "none"
        if macd_prev < macd_signal_prev and macd > macd_signal:
            macd_score = 25
            macd_crossover = "bullish"
            macd_status = "Bullish crossover - Strong buy signal"
        elif macd_prev > macd_signal_prev and macd < macd_signal:
            macd_score = 25
            macd_crossover = "bearish"
            macd_status = "Bearish crossover - Strong sell signal"
        elif macd > macd_signal:
            macd_score = 15
            macd_status = "Above signal line - Bullish"
        elif macd < macd_signal:
            macd_score = 15
            macd_status = "Below signal line - Bearish"
        else:
            macd_score = 5
            macd_status = "Neutral"
        
        score_breakdown["macd"] = {
            "score": macd_score,
            "macd": round(macd, 4),
            "signal": round(macd_signal, 4),
            "crossover": macd_crossover,
            "status": macd_status
        }
        total_score += macd_score
        
        # 3. Trend Analysis (0-20 points)
        if last_price > sma_20 and last_price > sma_50 and sma_20 > sma_50:
            trend_score = 20
            trend_status = "Strong uptrend - All MAs aligned"
        elif last_price > sma_20:
            trend_score = 12
            trend_status = "Short-term uptrend"
        elif last_price < sma_20 and last_price < sma_50 and sma_20 < sma_50:
            trend_score = 20
            trend_status = "Strong downtrend - All MAs aligned"
        elif last_price < sma_20:
            trend_score = 12
            trend_status = "Short-term downtrend"
        else:
            trend_score = 5
            trend_status = "Sideways/Neutral"
        
        score_breakdown["trend"] = {
            "score": trend_score,
            "price": round(last_price, 2),
            "sma_20": round(sma_20, 2),
            "sma_50": round(sma_50, 2),
            "status": trend_status
        }
        total_score += trend_score
        
        # 4. Bollinger Bands (0-15 points)
        if bb_position < 0.2:
            bb_score = 15
            bb_status = "Near lower band - Potential bounce"
        elif bb_position > 0.8:
            bb_score = 15
            bb_status = "Near upper band - Potential reversal"
        elif 0.4 <= bb_position <= 0.6:
            bb_score = 10
            bb_status = "Middle range - Balanced"
        else:
            bb_score = 5
            bb_status = "Neutral position"
        
        score_breakdown["bollinger"] = {
            "score": bb_score,
            "position_pct": round(bb_position * 100, 1),
            "bb_high": round(bb_high, 2),
            "bb_low": round(bb_low, 2),
            "status": bb_status
        }
        total_score += bb_score
        
        # 5. Volume Analysis (0-15 points)
        if volume_ratio > 1.5:
            volume_score = 15
            volume_status = "High volume surge - Strong interest"
        elif volume_ratio > 1.2:
            volume_score = 10
            volume_status = "Above average volume"
        elif volume_ratio > 0.8:
            volume_score = 5
            volume_status = "Normal volume"
        else:
            volume_score = 2
            volume_status = "Low volume - Weak interest"
        
        score_breakdown["volume"] = {
            "score": volume_score,
            "ratio": round(volume_ratio, 2),
            "current": int(volume),
            "average": int(volume_ma),
            "status": volume_status
        }
        total_score += volume_score
        
        # Determine signal
        signal = "HOLD"
        signal_confidence = 0
        signal_reasoning = []
        
        if total_score >= 60:
            # Check for BUY conditions
            if (rsi_14 < 65 and macd > macd_signal and momentum_pct > 0.2 and 
                last_price > sma_20):
                signal = "BUY"
                signal_confidence = min(total_score, 95)
                signal_reasoning = [
                    f"High score: {total_score}/100",
                    f"RSI {rsi_14:.1f} not overbought",
                    "MACD bullish",
                    f"Positive momentum {momentum_pct:.2f}%",
                    "Price above SMA20"
                ]
            # Check for SELL conditions
            elif (rsi_14 > 35 and macd < macd_signal and momentum_pct < -0.2 and 
                  last_price < sma_20):
                signal = "SELL"
                signal_confidence = min(total_score, 95)
                signal_reasoning = [
                    f"High score: {total_score}/100",
                    f"RSI {rsi_14:.1f} not oversold",
                    "MACD bearish",
                    f"Negative momentum {momentum_pct:.2f}%",
                    "Price below SMA20"
                ]
        
        # Calculate position size
        risk_pct = 2.0  # 2% risk per trade
        stop_loss_pct = 0.75
        risk_amount = capital * (risk_pct / 100)
        stop_distance = last_price * (stop_loss_pct / 100)
        suggested_quantity = max(int(risk_amount / stop_distance), 1)
        
        # Cap at 20% of capital
        max_quantity = int((capital * 0.2) / last_price)
        suggested_quantity = min(suggested_quantity, max_quantity)
        suggested_cost = suggested_quantity * last_price
        
        return {
            "instrument_key": instrument_key,
            "label": label,
            "viable": True,
            "last_price": round(last_price, 2),
            "total_score": round(total_score, 2),
            "score_breakdown": score_breakdown,
            "signal": signal,
            "signal_confidence": signal_confidence,
            "signal_reasoning": signal_reasoning,
            "suggested_quantity": suggested_quantity,
            "suggested_cost": round(suggested_cost, 2),
            "risk_reward": {
                "entry": round(last_price, 2),
                "stop_loss": round(last_price * (1 - stop_loss_pct / 100), 2),
                "target": round(last_price * (1 + 1.5 / 100), 2),  # 1.5% target
                "risk_amount": round(risk_amount, 2),
                "potential_profit": round(suggested_quantity * last_price * 0.015, 2)
            },
            "momentum_pct": round(momentum_pct, 2),
            "adx": round(adx, 2),
            "atr": round(atr, 2)
        }
    
    except Exception as e:
        logger.exception(f"Analysis failed for {label}: {e}")
        return {
            "instrument_key": instrument_key,
            "label": label,
            "viable": False,
            "reason": f"Analysis error: {str(e)}"
        }


async def _save_decision_history(db, user_id: str, decision: dict) -> None:
    """Save decision to database for historical tracking."""
    await db["trading_decisions"].insert_one({
        "user_id": user_id,
        "timestamp": datetime.now(timezone.utc),
        "decision_type": decision["type"],
        "stock": decision.get("stock"),
        "details": decision.get("details", {}),
        "created_at": datetime.now(timezone.utc)
    })


async def _calculate_performance_metrics(db, user_id: str) -> dict:
    """Calculate comprehensive performance metrics."""
    trades = await db["trades"].find({
        "user_id": user_id,
        "pnl": {"$ne": None}
    }).to_list(length=10000)
    
    if not trades:
        return {
            "total_trades": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "sharpe_ratio": 0,
            "max_drawdown": 0
        }
    
    wins = [float(t["pnl"]) for t in trades if float(t.get("pnl", 0)) > 0]
    losses = [float(t["pnl"]) for t in trades if float(t.get("pnl", 0)) < 0]
    
    total_wins = sum(wins) if wins else 0
    total_losses = abs(sum(losses)) if losses else 0
    
    metrics = {
        "total_trades": len(trades),
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "win_rate": round(len(wins) / len(trades) * 100, 2) if trades else 0,
        "avg_win": round(sum(wins) / len(wins), 2) if wins else 0,
        "avg_loss": round(sum(losses) / len(losses), 2) if losses else 0,
        "profit_factor": round(total_wins / total_losses, 2) if total_losses > 0 else 0,
        "total_pnl": round(sum(float(t.get("pnl", 0)) for t in trades), 2)
    }
    
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
        metrics["max_drawdown"] = round(max_dd, 2)
    else:
        metrics["max_drawdown"] = 0
    
    # Sharpe ratio
    if len(trades) > 1:
        returns = [float(t.get("pnl", 0)) for t in trades]
        avg_return = sum(returns) / len(returns)
        std_return = (sum((r - avg_return) ** 2 for r in returns) / len(returns)) ** 0.5
        metrics["sharpe_ratio"] = round(avg_return / std_return if std_return > 0 else 0, 2)
    else:
        metrics["sharpe_ratio"] = 0
    
    _status["performance_metrics"] = metrics
    return metrics


async def _run_professional_cycle(db, state: dict) -> None:
    """Professional trading cycle with detailed logging."""
    user_id = state["user_id"]
    capital = float(state.get("max_capital_allocation", 50000))
    paper_trading = bool(state.get("paper_trading", True))
    
    _log(f"=== Starting Trading Cycle ===", "INFO")
    _log(f"Capital: ₹{capital:,.2f} | Mode: {'PAPER' if paper_trading else 'LIVE'}", "INFO")
    
    # Calculate performance metrics
    metrics = await _calculate_performance_metrics(db, user_id)
    _log(f"Performance: Win Rate {metrics['win_rate']}% | P&L ₹{metrics['total_pnl']:.2f}", "INFO")
    
    # Get credentials
    upstox = UpstoxService(db)
    try:
        credential = await upstox.get_credential(user_id)
    except Exception as e:
        _log(f"Failed to get credentials: {e}", "ERROR")
        return
    
    # Scan all stocks
    _log("Scanning stock universe...", "INFO")
    scanner = StockScannerService(db)
    
    try:
        scan_results = await scanner.scan_universe(interval="5minute", min_candles=60, top_n=10)
        _log(f"Scanner found {len(scan_results)} candidates", "SUCCESS")
    except Exception as e:
        _log(f"Scanner failed: {e}", "ERROR")
        scan_results = []
    
    # Analyze each stock in detail
    detailed_analyses = []
    for stock in scan_results:
        instrument_key = stock["symbol"]
        
        # Get quote
        try:
            quotes_resp = await upstox.get_quotes(credential.access_token, [instrument_key])
            quote = (quotes_resp.get("data") or {}).get(instrument_key) or {}
        except:
            continue
        
        # Get candles
        from app.services.market_data import MarketDataService
        svc = MarketDataService(db)
        candles = await svc.recent_candles(instrument_key, "5minute", limit=60)
        candle_dicts = [
            {"open": float(c.open), "high": float(c.high), "low": float(c.low),
             "close": float(c.close), "volume": c.volume}
            for c in candles
        ]
        
        # Comprehensive analysis
        analysis = await _analyze_stock_comprehensive(instrument_key, quote, candle_dicts, capital)
        if analysis["viable"]:
            detailed_analyses.append(analysis)
    
    _status["current_scan_results"] = detailed_analyses
    
    # Sort by score
    detailed_analyses.sort(key=lambda x: x["total_score"], reverse=True)
    
    # Log top 5 candidates
    _log(f"\n=== Top Stock Candidates ===", "INFO")
    for i, analysis in enumerate(detailed_analyses[:5], 1):
        _log(
            f"{i}. {analysis['label']}: Score {analysis['total_score']}/100 | "
            f"Signal: {analysis['signal']} | Price: ₹{analysis['last_price']}",
            "INFO"
        )
    
    # Find best trading opportunity
    best_candidate = None
    for analysis in detailed_analyses:
        if analysis["signal"] in ["BUY", "SELL"] and analysis["signal_confidence"] >= 60:
            best_candidate = analysis
            break
    
    if not best_candidate:
        _log("No strong trading opportunity found. Waiting for better setup.", "INFO")
        _log_decision("NO_TRADE", "N/A", {
            "reason": "No stock met minimum confidence threshold (60%)",
            "candidates_analyzed": len(detailed_analyses),
            "best_score": detailed_analyses[0]["total_score"] if detailed_analyses else 0
        })
        return
    
    # Log detailed decision
    _log(f"\n=== TRADE DECISION: {best_candidate['signal']} {best_candidate['label']} ===", "SUCCESS")
    _log(f"Confidence: {best_candidate['signal_confidence']}%", "INFO")
    _log(f"Price: ₹{best_candidate['last_price']} | Quantity: {best_candidate['suggested_quantity']}", "INFO")
    _log(f"Total Cost: ₹{best_candidate['suggested_cost']:.2f}", "INFO")
    
    _log("\nReasoning:", "INFO")
    for reason in best_candidate["signal_reasoning"]:
        _log(f"  • {reason}", "INFO")
    
    _log("\nScore Breakdown:", "INFO")
    for indicator, data in best_candidate["score_breakdown"].items():
        _log(f"  {indicator.upper()}: {data['score']}/25 - {data['status']}", "INFO")
    
    # Save decision to history
    decision = {
        "type": "ENTRY",
        "stock": best_candidate["label"],
        "details": best_candidate
    }
    _log_decision("ENTRY", best_candidate["label"], best_candidate)
    await _save_decision_history(db, user_id, decision)
    
    _log(f"\n{'='*50}", "INFO")


async def _loop_professional(interval_seconds: int = 60) -> None:
    """Professional trading loop."""
    global _status
    db = _db()
    _status["running"] = True
    _log("Professional Auto-Trader Started", "SUCCESS")
    
    while True:
        try:
            state = await db["auto_trading_state"].find_one({"enabled": True})
            if state is None:
                await asyncio.sleep(interval_seconds)
                continue
            
            await _run_professional_cycle(db, state)
            _status["cycles"] += 1
            _status["last_cycle"] = datetime.now(timezone.utc).isoformat()
            _status["last_error"] = None
        except Exception as exc:
            _status["last_error"] = str(exc)
            _log(f"Cycle error: {exc}", "ERROR")
            logger.exception("Professional auto-trader cycle error: %s", exc)
        
        await asyncio.sleep(interval_seconds)


def get_professional_status() -> dict:
    """Get detailed status for UI."""
    return _status


def start_professional_trader(interval_seconds: int = 60) -> None:
    """Start the professional auto trader."""
    global _task
    if _task is not None and not _task.done():
        return
    _task = asyncio.get_event_loop().create_task(_loop_professional(interval_seconds))
    logger.info("Professional auto-trader task created")


def stop_professional_trader() -> None:
    """Stop the professional auto trader."""
    global _task
    if _task and not _task.done():
        _task.cancel()
        _task = None
    _status["running"] = False
    _log("Professional Auto-Trader Stopped", "INFO")
