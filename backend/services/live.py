from services.utils import seeded_random, iso_now


def live_snapshot(symbol):
    rng = seeded_random(symbol, "live")
    price = round(rng.uniform(120, 320), 2)
    change = round(rng.uniform(-1.8, 2.2), 2)
    return {
        "symbol": symbol,
        "price": price,
        "change": change,
        "market_state": "open" if 9 <= rng.randint(0, 23) <= 15 else "closed",
        "updated_at": iso_now(),
    }
