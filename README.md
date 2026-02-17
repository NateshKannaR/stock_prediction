# Stock Prediction Platform

React + Flask + MongoDB platform scaffold with advanced AI modules, sentiment hooks, and ML training stubs.

## Features
- Multi-page React suite (prediction, sentiment, indicators, backtesting, risk, accounts)
- Flask API with indicators (RSI, MACD, SMA, EMA, Bollinger, VWAP, Fibonacci)
- Multi-model ensemble prediction stubs (LSTM, XGBoost, Random Forest)
- MongoDB storage for news and predictions
- FinBERT sentiment hook (optional)
- Upstox broker stub endpoints (ready for OAuth wiring)
- Portfolio simulator, backtesting, strategy builder, risk dashboard, explainability, institutional + macro modules

## Local development

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

```bash
# Frontend
cd frontend
npm install
npm run dev
```

## Docker (production-ready scaffold)

```bash
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend: http://localhost:5000

## API overview
- `GET /api/health`
- `GET /api/news?symbol=AAPL`
- `GET /api/news/sentiment?symbol=AAPL`
- `GET /api/news/sources`
- `POST /api/news` (ingest news)
- `GET /api/stocks/<symbol>/history`
- `POST /api/indicators`
- `GET /api/indicators/catalog`
- `POST /api/indicators/advanced`
- `POST /api/predict`
- `POST /api/predict/ensemble`
- `GET /api/predict/multiframe?symbol=AAPL`
- `POST /api/portfolio/simulate`
- `POST /api/backtest/run`
- `POST /api/strategy/parse`
- `POST /api/strategy/evaluate`
- `GET /api/live/price?symbol=AAPL`
- `GET /api/risk/overview?symbol=AAPL`
- `GET /api/explainability?symbol=AAPL`
- `GET /api/institutional?symbol=AAPL`
- `GET /api/macro?region=IN`
- `POST /api/assistant`
- `POST /api/users/register`
- `POST /api/users/login`
- `GET /api/users/watchlist`
- `POST /api/users/watchlist`
- `GET /api/users/history`
- `POST /api/train`
- `GET /api/broker/status`
- `POST /api/broker/order`

## Notes
- Reuters/Moneycontrol scraping is not enabled by default. Use `/api/news` to ingest data or add scrapers.
- Most advanced modules return deterministic mock data until you connect live data sources.
- Upstox integration requires OAuth credentials (see `.env.example`). Live orders are blocked until configured.
- Model training endpoints are scaffolded. Wire LSTM/XGBoost/Transformer pipelines into `backend/services/training.py`.
