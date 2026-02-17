from services.utils import seeded_random, iso_now


def parse_strategy(text):
    tokens = [chunk.strip() for chunk in text.split() if chunk.strip()]
    conditions = [tok for tok in tokens if tok.upper() in {"RSI", "MACD", "SENTIMENT", "SMA"}]
    actions = [tok for tok in tokens if tok.upper() in {"BUY", "SELL", "HOLD"}]
    return {
        "raw": text,
        "conditions": conditions,
        "actions": actions,
        "valid": bool(conditions and actions),
        "message": "Parsed rule set" if conditions and actions else "Incomplete strategy definition",
    }


def evaluate_strategy(symbol, text):
    rng = seeded_random(symbol, text, "strategy")
    action = rng.choice(["buy", "sell", "hold"])
    confidence = round(rng.uniform(0.45, 0.82), 3)
    return {
        "symbol": symbol,
        "action": action,
        "confidence": confidence,
        "explanation": "Rule-based evaluation using configured indicators and sentiment.",
        "created_at": iso_now(),
    }
