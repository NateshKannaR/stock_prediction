from datetime import datetime

from services.sentiment import score_sentiment


def score_signal(symbol, frame, news_items):
    latest = frame.iloc[-1]
    reasons = []
    score = 0.0

    if latest["rsi"] < 30:
        score += 1.0
        reasons.append("RSI indicates oversold")
    elif latest["rsi"] > 70:
        score -= 1.0
        reasons.append("RSI indicates overbought")

    if latest["macd_hist"] > 0:
        score += 0.8
        reasons.append("MACD histogram positive")
    else:
        score -= 0.4
        reasons.append("MACD histogram negative")

    if latest["sma_fast"] > latest["sma_slow"]:
        score += 0.7
        reasons.append("SMA fast above SMA slow")
    else:
        score -= 0.5
        reasons.append("SMA fast below SMA slow")

    sentiment_inputs = [item.get("title", "") for item in news_items if item.get("title")]
    sentiment_score = score_sentiment(sentiment_inputs)
    if sentiment_score > 0.1:
        score += 0.6
        reasons.append("News sentiment positive")
    elif sentiment_score < -0.1:
        score -= 0.6
        reasons.append("News sentiment negative")

    if score >= 1.5:
        action = "buy"
    elif score <= -1.5:
        action = "sell"
    else:
        action = "hold"

    confidence = min(abs(score) / 3.0, 1.0)

    return {
        "symbol": symbol,
        "action": action,
        "score": round(score, 3),
        "confidence": round(confidence, 3),
        "sentiment": round(sentiment_score, 3),
        "reasons": reasons,
        "latest": {
            "date": str(latest["date"]),
            "close": float(latest["close"]),
            "rsi": float(latest["rsi"]),
            "macd_hist": float(latest["macd_hist"]),
            "sma_fast": float(latest["sma_fast"]),
            "sma_slow": float(latest["sma_slow"]),
        },
        "created_at": datetime.utcnow().isoformat(),
    }
