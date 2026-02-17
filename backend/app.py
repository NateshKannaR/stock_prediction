from flask import Flask, jsonify, request
from flask_cors import CORS

from config import Config
from db import get_db
from services.indicators import compute_indicators
from services.ensemble import ensemble_predict, multi_timeframe
from services.market import fetch_history
from services.news import list_news, store_news
from services.prediction import score_signal
from services.portfolio import simulate_portfolio
from services.backtest import run_backtest
from services.strategy import parse_strategy, evaluate_strategy
from services.risk import risk_overview
from services.institutional import institutional_snapshot
from services.macro import macro_snapshot
from services.explainability import explain_prediction
from services.live import live_snapshot
from services.sentiment import sentiment_breakdown
from services.assistant import answer_question
from services.accounts import (
    register_user,
    login_user,
    get_user_by_token,
    get_watchlist,
    add_watchlist,
    add_history,
    get_history,
)
from services.training import start_training_job
from services.broker import get_status, place_order


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/api/news")
    def get_news():
        symbol = request.args.get("symbol", "")
        limit = int(request.args.get("limit", 12))
        db = get_db(app)
        items = list_news(db, symbol, limit)
        return jsonify({"symbol": symbol, "items": items})

    @app.post("/api/news")
    def post_news():
        payload = request.get_json(silent=True) or {}
        items = payload.get("items", [])
        symbol = payload.get("symbol", "")
        db = get_db(app)
        stored = store_news(db, symbol, items)
        return jsonify({"stored": stored})

    @app.get("/api/stocks/<symbol>/history")
    def history(symbol):
        start = request.args.get("start")
        end = request.args.get("end")
        try:
            frame = fetch_history(symbol, start=start, end=end)
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"symbol": symbol, "rows": frame.tail(200).to_dict(orient="records")})

    @app.post("/api/indicators")
    def indicators():
        payload = request.get_json(silent=True) or {}
        symbol = payload.get("symbol")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        try:
            frame = fetch_history(symbol, start=payload.get("start"), end=payload.get("end"))
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 400
        enriched = compute_indicators(frame)
        return jsonify({"symbol": symbol, "rows": enriched.tail(200).to_dict(orient="records")})

    @app.post("/api/predict")
    def predict():
        payload = request.get_json(silent=True) or {}
        symbol = payload.get("symbol")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        try:
            frame = fetch_history(symbol, start=payload.get("start"), end=payload.get("end"))
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 400
        enriched = compute_indicators(frame)
        db = get_db(app)
        news_items = list_news(db, symbol, 30)
        signal = score_signal(symbol, enriched, news_items)
        try:
            predictions = db["predictions"]
            predictions.insert_one(signal)
        except Exception:
            pass
        token = request.headers.get("X-Auth-Token")
        email = get_user_by_token(token) if token else None
        if email:
            add_history(email, {"symbol": symbol, "action": signal.get("action"), "score": signal.get("score")})
        return jsonify(signal)

    @app.post("/api/train")
    def train():
        payload = request.get_json(silent=True) or {}
        job = start_training_job(payload)
        return jsonify(job)

    @app.get("/api/broker/status")
    def broker_status():
        return jsonify(get_status())

    @app.post("/api/broker/order")
    def broker_order():
        payload = request.get_json(silent=True) or {}
        return jsonify(place_order(payload))

    @app.post("/api/predict/ensemble")
    def predict_ensemble():
        payload = request.get_json(silent=True) or {}
        symbol = payload.get("symbol")
        timeframe = payload.get("timeframe", "daily")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        return jsonify(ensemble_predict(symbol, timeframe))

    @app.get("/api/predict/multiframe")
    def predict_multiframe():
        symbol = request.args.get("symbol")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        return jsonify(multi_timeframe(symbol))

    @app.get("/api/indicators/catalog")
    def indicators_catalog():
        return jsonify(
            {
                "indicators": [
                    {"id": "rsi", "label": "RSI", "defaults": {"period": 14}},
                    {"id": "macd", "label": "MACD", "defaults": {"fast": 12, "slow": 26, "signal": 9}},
                    {"id": "bollinger", "label": "Bollinger Bands", "defaults": {"period": 20, "std": 2}},
                    {"id": "sma", "label": "SMA", "defaults": {"fast": 20, "slow": 50}},
                    {"id": "ema", "label": "EMA", "defaults": {"fast": 12, "slow": 26}},
                    {"id": "vwap", "label": "VWAP", "defaults": {}},
                    {"id": "fibonacci", "label": "Fibonacci", "defaults": {}},
                ]
            }
        )

    @app.post("/api/indicators/advanced")
    def indicators_advanced():
        payload = request.get_json(silent=True) or {}
        symbol = payload.get("symbol")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        try:
            frame = fetch_history(symbol, start=payload.get("start"), end=payload.get("end"))
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 400
        settings = payload.get("settings", {})
        enriched = compute_indicators(frame, settings=settings)
        return jsonify({"symbol": symbol, "rows": enriched.tail(200).to_dict(orient="records")})

    @app.get("/api/news/sentiment")
    def news_sentiment():
        symbol = request.args.get("symbol", "")
        limit = int(request.args.get("limit", 30))
        db = get_db(app)
        items = list_news(db, symbol, limit)
        return jsonify({"symbol": symbol, "breakdown": sentiment_breakdown(items, symbol), "items": items})

    @app.get("/api/news/sources")
    def news_sources():
        return jsonify(
            {
                "sources": [
                    {"name": "Reuters", "status": "ready"},
                    {"name": "Moneycontrol", "status": "ready"},
                    {"name": "Yahoo Finance", "status": "ready"},
                    {"name": "NSE Announcements", "status": "ready"},
                ]
            }
        )

    @app.post("/api/portfolio/simulate")
    def portfolio_sim():
        payload = request.get_json(silent=True) or {}
        return jsonify(simulate_portfolio(payload))

    @app.post("/api/backtest/run")
    def backtest_run():
        payload = request.get_json(silent=True) or {}
        return jsonify(run_backtest(payload))

    @app.post("/api/strategy/parse")
    def strategy_parse():
        payload = request.get_json(silent=True) or {}
        text = payload.get("rule", "")
        return jsonify(parse_strategy(text))

    @app.post("/api/strategy/evaluate")
    def strategy_eval():
        payload = request.get_json(silent=True) or {}
        symbol = payload.get("symbol", "")
        text = payload.get("rule", "")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        return jsonify(evaluate_strategy(symbol, text))

    @app.get("/api/live/price")
    def live_price():
        symbol = request.args.get("symbol", "")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        return jsonify(live_snapshot(symbol))

    @app.get("/api/risk/overview")
    def risk_dash():
        symbol = request.args.get("symbol", "")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        return jsonify(risk_overview(symbol))

    @app.get("/api/explainability")
    def explainability():
        symbol = request.args.get("symbol", "")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        return jsonify(explain_prediction(symbol))

    @app.get("/api/institutional")
    def institutional():
        symbol = request.args.get("symbol", "")
        if not symbol:
            return jsonify({"error": "symbol is required"}), 400
        return jsonify(institutional_snapshot(symbol))

    @app.get("/api/macro")
    def macro():
        region = request.args.get("region", "IN")
        return jsonify(macro_snapshot(region))

    @app.post("/api/assistant")
    def assistant():
        payload = request.get_json(silent=True) or {}
        return jsonify(answer_question(payload.get("question"), payload.get("symbol")))

    @app.post("/api/users/register")
    def user_register():
        payload = request.get_json(silent=True) or {}
        email = payload.get("email")
        password = payload.get("password")
        if not email or not password:
            return jsonify({"error": "email and password required"}), 400
        result = register_user(email, password)
        if result.get("error"):
            return jsonify(result), 400
        return jsonify(result)

    @app.post("/api/users/login")
    def user_login():
        payload = request.get_json(silent=True) or {}
        email = payload.get("email")
        password = payload.get("password")
        if not email or not password:
            return jsonify({"error": "email and password required"}), 400
        result = login_user(email, password)
        if result.get("error"):
            return jsonify(result), 401
        return jsonify(result)

    @app.get("/api/users/watchlist")
    def user_watchlist():
        token = request.headers.get("X-Auth-Token")
        email = get_user_by_token(token)
        if not email:
            return jsonify({"error": "unauthorized"}), 401
        return jsonify({"email": email, "watchlist": get_watchlist(email)})

    @app.post("/api/users/watchlist")
    def user_watchlist_add():
        token = request.headers.get("X-Auth-Token")
        email = get_user_by_token(token)
        if not email:
            return jsonify({"error": "unauthorized"}), 401
        payload = request.get_json(silent=True) or {}
        symbol = payload.get("symbol")
        return jsonify({"email": email, "watchlist": add_watchlist(email, symbol)})

    @app.get("/api/users/history")
    def user_history():
        token = request.headers.get("X-Auth-Token")
        email = get_user_by_token(token)
        if not email:
            return jsonify({"error": "unauthorized"}), 401
        return jsonify({"email": email, "history": get_history(email)})

    return app


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=5000)
