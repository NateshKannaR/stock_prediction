from services.utils import seeded_random, iso_now


def institutional_snapshot(symbol):
    rng = seeded_random(symbol, "institutional")
    return {
        "symbol": symbol,
        "fii_flow": round(rng.uniform(-250, 320), 2),
        "dii_flow": round(rng.uniform(-180, 240), 2),
        "insider_activity": rng.choice(["Net Buying", "Net Selling", "Neutral"]),
        "earnings_impact": rng.choice(["Positive", "Neutral", "Negative"]),
        "block_deals": [
            {"party": "Institutional Desk A", "volume": rng.randint(120000, 350000)},
            {"party": "Institutional Desk B", "volume": rng.randint(80000, 260000)},
        ],
        "created_at": iso_now(),
    }
