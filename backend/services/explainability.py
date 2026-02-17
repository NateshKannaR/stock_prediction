from services.utils import seeded_random, iso_now


def explain_prediction(symbol):
    rng = seeded_random(symbol, "explain")
    features = [
        ("RSI", rng.uniform(-0.1, 0.2)),
        ("Sentiment", rng.uniform(-0.08, 0.18)),
        ("MACD", rng.uniform(-0.12, 0.12)),
        ("SMA Cross", rng.uniform(-0.1, 0.14)),
        ("Volume", rng.uniform(-0.06, 0.1)),
    ]
    contributions = [
        {"feature": name, "impact": round(value, 3)} for name, value in features
    ]
    total = round(sum(item["impact"] for item in contributions), 3)
    return {
        "symbol": symbol,
        "contributions": contributions,
        "total_impact": total,
        "created_at": iso_now(),
    }
