from services.utils import seeded_random, iso_now


def simulate_portfolio(payload):
    symbol = payload.get("symbol", "AAPL")
    initial_cash = float(payload.get("initial_cash", 100000))
    trades = payload.get("trades", [])

    rng = seeded_random(symbol, "portfolio", len(trades))
    pnl = round(rng.uniform(-0.06, 0.14) * initial_cash, 2)
    sharpe = round(rng.uniform(0.4, 1.8), 2)
    drawdown = round(rng.uniform(0.03, 0.22), 3)
    risk_score = round(rng.uniform(0.2, 0.8), 3)

    equity_curve = []
    equity = initial_cash
    for idx in range(12):
        step = rng.uniform(-0.01, 0.02) * initial_cash
        equity = max(0, equity + step)
        equity_curve.append({"step": idx + 1, "equity": round(equity, 2)})

    return {
        "symbol": symbol,
        "initial_cash": initial_cash,
        "pnl": pnl,
        "ending_value": round(initial_cash + pnl, 2),
        "sharpe": sharpe,
        "max_drawdown": drawdown,
        "risk_score": risk_score,
        "equity_curve": equity_curve,
        "trade_count": len(trades),
        "created_at": iso_now(),
    }
