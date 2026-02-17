from services.utils import iso_now


def answer_question(question, symbol=None):
    q = (question or "").lower()
    if "why" in q and symbol:
        reply = f"{symbol} moved on mixed momentum and sentiment signals. Check volume spikes and news catalysts."
    elif "buy" in q:
        reply = "This is not financial advice. The current signal mix suggests caution; review risk controls."
    elif "summarize" in q or "today" in q:
        reply = "Markets are range-bound with elevated volatility; macro headlines remain the main driver."
    else:
        reply = "I can analyze sentiment, technicals, and risk signals. Ask about a specific symbol or timeframe."
    return {"reply": reply, "created_at": iso_now()}
