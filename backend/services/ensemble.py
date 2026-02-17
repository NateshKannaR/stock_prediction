from services.utils import seeded_random


MODEL_WEIGHTS = {
    "LSTM": 0.42,
    "XGBoost": 0.33,
    "RandomForest": 0.25,
}


def _direction_from_delta(delta):
    return "up" if delta >= 0 else "down"


def _confidence(score):
    return max(0.05, min(0.95, score))


def ensemble_predict(symbol, timeframe="daily"):
    rng = seeded_random(symbol, timeframe, "ensemble")
    base_price = rng.uniform(120, 320)
    drift = {"intraday": 0.008, "daily": 0.018, "weekly": 0.042}.get(timeframe, 0.018)

    models = []
    for model in MODEL_WEIGHTS:
        jitter = rng.uniform(-0.015, 0.02)
        delta = drift + jitter
        price = round(base_price * (1 + delta), 2)
        confidence = _confidence(0.55 + rng.uniform(-0.08, 0.18))
        models.append(
            {
                "name": model,
                "direction": _direction_from_delta(delta),
                "price": price,
                "confidence": round(confidence, 3),
            }
        )

    weighted_score = sum(
        MODEL_WEIGHTS[item["name"]] * (1 if item["direction"] == "up" else -1)
        for item in models
    )
    weighted_price = sum(MODEL_WEIGHTS[item["name"]] * item["price"] for item in models)
    probability_up = _confidence(0.5 + weighted_score * 0.3)
    direction = "up" if weighted_score >= 0 else "down"

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "direction": direction,
        "next_close": round(weighted_price, 2),
        "probability": round(probability_up, 3),
        "models": models,
        "weights": MODEL_WEIGHTS,
    }


def multi_timeframe(symbol):
    return {
        "intraday": ensemble_predict(symbol, timeframe="intraday"),
        "daily": ensemble_predict(symbol, timeframe="daily"),
        "weekly": ensemble_predict(symbol, timeframe="weekly"),
    }
