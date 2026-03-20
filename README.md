# Benx Quant Trading Platform

Benx Quant Trading Platform is a full-stack stock prediction and automated trading platform for the Indian market built around the Upstox API. The stack combines a Next.js dark trading dashboard, a FastAPI backend, PostgreSQL, Redis, live websocket streaming, AI-driven signal generation, risk-managed execution, and historical backtesting.

## Features

- **Multi-Stock Intraday Scanner**: AI-powered stock selection from 30+ liquid NSE stocks
- **Automated Trading**: Risk-managed execution with profit targets and stop-loss
- **LSTM Predictions**: Deep learning model for BUY/SELL/HOLD signals
- **Live Market Data**: Real-time websocket streaming from Upstox
- **Historical Backtesting**: Test strategies on past data
- **Portfolio Management**: Track positions, P&L, and trade history
- **Dark Trading Dashboard**: Modern Next.js UI with real-time updates

See [STOCK_SCANNER.md](STOCK_SCANNER.md) for details on the intelligent stock selection system.

## Architecture

- `frontend/`: Next.js App Router dashboard with Tailwind CSS, shadcn-style UI primitives, Recharts, and Socket.IO.
- `backend/`: FastAPI APIs, JWT auth, Upstox integration, websocket fanout, and persistence.
- `ai_models/`: LSTM model, feature engineering, training, and inference helpers.
- `trading_engine/`: Order sizing, risk controls, and execution orchestration.
- `database/`: PostgreSQL schema bootstrap.
- `websocket/`: Socket.IO server adapter notes and message contracts.
- `config/`: Environment templates.

## Real data policy

This project does not generate fake candles, fake trades, or random predictions. Runtime pages render only:

- Data fetched from Upstox REST and websocket APIs
- Data persisted from live or historical Upstox responses
- Metrics derived from the stored market/trade data

Without valid credentials and infrastructure, the platform renders empty states or connection errors instead of mock content.

## Quick start

1. Copy [config/.env.example](/home/natesh/Quant_Stock/config/.env.example) to `.env` and fill real values.
2. Start PostgreSQL and Redis, or use `docker compose up -d postgres redis`.
3. Install backend dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

4. Install frontend dependencies:

```bash
cd frontend
npm install
```

5. Initialize the database:

```bash
psql "$DATABASE_URL" -f database/init.sql
```

6. Start the backend:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

7. Start the frontend:

```bash
cd frontend
npm run dev
```

## Upstox setup

- Create an Upstox app and configure the redirect URI.
- Generate an authorization code through the Upstox login flow.
- Exchange that code for an access token through the backend `/api/v1/auth/upstox/exchange` endpoint.
- Store your live `access_token` and `feed_token` in PostgreSQL through the settings flow.

## Key backend flows

- `POST /api/v1/auth/login`: JWT login for local platform access
- `POST /api/v1/auth/upstox/exchange`: Exchange authorization code for Upstox tokens
- `GET /api/v1/market/quotes`: Fetch live quotes from Upstox
- `POST /api/v1/market/history/load`: Persist historical candles from Upstox
- `GET /api/v1/predictions/signals`: Generate BUY/SELL/HOLD signals from the LSTM pipeline
- `POST /api/v1/scanner/scan`: Scan stock universe and rank best intraday candidates
- `GET /api/v1/scanner/latest`: Retrieve latest stock scanner results
- `POST /api/v1/trading/auto-trading/toggle`: Enable or disable automated trading
- `POST /api/v1/backtesting/run`: Execute historical backtests

## Production notes

- Use HTTPS and a reverse proxy such as Nginx or Traefik in production.
- Rotate JWT and Upstox secrets through your secret manager.
- Run the market streamer as a background worker so websockets do not block API threads.
- Backtests and model training should run via a task queue in high-volume environments.

