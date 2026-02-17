from services.utils import seeded_random, iso_now


def run_backtest(payload):
    symbol = payload.get("symbol", "AAPL")
    start = payload.get("start")
    end = payload.get("end")
    strategy = payload.get("strategy", "rsi_reversion")
    rng = seeded_random(symbol, start, end, strategy)

    total_return = round(rng.uniform(-0.12, 0.32), 3)
    win_rate = round(rng.uniform(0.42, 0.68), 3)
    max_drawdown = round(rng.uniform(0.05, 0.3), 3)
    trades = [
        {
            "id": idx + 1,
            "side": "buy" if rng.random() > 0.4 else "sell",
            "entry": round(rng.uniform(120, 220), 2),
            "exit": round(rng.uniform(120, 220), 2),
            "pnl": round(rng.uniform(-0.04, 0.06), 3),
        }
        for idx in range(8)
    ]

    return {
        "symbol": symbol,
        "start": start,
        "end": end,
        "strategy": strategy,
        "total_return": total_return,
        "win_rate": win_rate,
        "max_drawdown": max_drawdown,
        "trades": trades,
        "created_at": iso_now(),
    }
