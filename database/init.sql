CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS upstox_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  access_token TEXT NOT NULL,
  feed_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  profile JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candles (
  id BIGSERIAL PRIMARY KEY,
  instrument_key VARCHAR(100) NOT NULL,
  interval VARCHAR(20) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  open NUMERIC(18,4) NOT NULL,
  high NUMERIC(18,4) NOT NULL,
  low NUMERIC(18,4) NOT NULL,
  close NUMERIC(18,4) NOT NULL,
  volume BIGINT NOT NULL,
  oi BIGINT,
  source VARCHAR(30) NOT NULL DEFAULT 'upstox',
  CONSTRAINT uq_candle_key UNIQUE (instrument_key, interval, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_candles_instrument_interval ON candles (instrument_key, interval, timestamp DESC);

CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  strategy_name VARCHAR(100) NOT NULL,
  instrument_key VARCHAR(100) NOT NULL,
  side VARCHAR(10) NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(18,4) NOT NULL,
  status VARCHAR(30) NOT NULL,
  upstox_order_id VARCHAR(100),
  pnl NUMERIC(18,4),
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user_created_at ON trades (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS positions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  instrument_key VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL,
  average_price NUMERIC(18,4) NOT NULL,
  last_price NUMERIC(18,4),
  unrealized_pnl NUMERIC(18,4),
  realized_pnl NUMERIC(18,4),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_position UNIQUE (user_id, instrument_key)
);

CREATE TABLE IF NOT EXISTS strategy_configs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  instruments JSONB NOT NULL,
  indicators JSONB NOT NULL,
  entry_rules JSONB NOT NULL,
  exit_rules JSONB NOT NULL,
  risk_params JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auto_trading_state (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paper_trading BOOLEAN NOT NULL DEFAULT TRUE,
  daily_loss_limit NUMERIC(18,4) NOT NULL DEFAULT 0,
  max_capital_allocation NUMERIC(18,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_scores (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(100) NOT NULL,
  scan_time TIMESTAMPTZ NOT NULL,
  intraday_score NUMERIC(10,4) NOT NULL,
  volatility NUMERIC(10,4),
  volume_surge NUMERIC(10,4),
  trend_strength NUMERIC(10,4),
  ml_confidence NUMERIC(10,4),
  ml_signal VARCHAR(10),
  liquidity NUMERIC(10,4),
  momentum NUMERIC(10,4),
  sector VARCHAR(50),
  sentiment_score NUMERIC(10,4),
  sentiment_label VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_stock_scores_scan_time ON stock_scores (scan_time DESC);
CREATE INDEX IF NOT EXISTS idx_stock_scores_symbol ON stock_scores (symbol, scan_time DESC);

CREATE TABLE IF NOT EXISTS news_sentiment (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(100) NOT NULL,
  company VARCHAR(200),
  sentiment_score NUMERIC(10,4) NOT NULL,
  sentiment_label VARCHAR(20) NOT NULL,
  news_count INTEGER NOT NULL,
  positive_count INTEGER NOT NULL,
  negative_count INTEGER NOT NULL,
  neutral_count INTEGER NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_sentiment_symbol ON news_sentiment (symbol, analyzed_at DESC);

