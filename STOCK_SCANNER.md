# Stock Scanner & Multi-Stock Intraday Trading

## Overview

The platform now includes an **intelligent stock scanner** that automatically selects the best intraday trading candidates from a universe of 30+ liquid NSE stocks, replacing the need to manually pick a single stock.

## How It Works

### 1. Stock Universe
- **30 pre-selected liquid NSE stocks** across sectors (Banking, IT, Auto, Energy, FMCG, etc.)
- Defined in `backend/app/models/watchlist.py`
- Includes: Reliance, HDFC Bank, Infosys, TCS, ICICI Bank, SBI, Tata Steel, ITC, L&T, and more

### 2. Scanning Process

The scanner (`backend/app/services/stock_scanner.py`) evaluates each stock using:

#### Metrics Calculated:
- **Volatility (ATR)**: Average True Range normalized by price — higher = more profit potential
- **Volume Surge**: Current volume vs 20-day average — confirms price moves
- **Trend Strength (ADX)**: Directional movement indicator — strong trends easier to trade
- **ML Confidence**: LSTM model prediction confidence score
- **ML Signal**: BUY/SELL/HOLD from the AI model
- **Liquidity**: Bid-ask spread proxy — tighter spreads reduce slippage
- **Momentum**: Recent price change percentage

#### Composite Score Formula:
```python
intraday_score = (
    volatility * 0.25 +
    volume_surge * 0.25 +
    trend_strength * 0.20 +
    ml_confidence * 0.20 +
    (1/liquidity) * 0.10
)
# Boosted by 20% if signal is BUY or SELL
```

### 3. Stock Selection

**Auto-Trader Integration:**
- Scans universe every 15-30 minutes (configurable)
- Ranks all stocks by composite score
- Selects **top 5 stocks** with clear BUY/SELL signals
- Picks the highest-scoring stock that:
  - Has a BUY or SELL signal (not HOLD)
  - Is affordable (price ≤ 50% of allocated capital)
  - Has sufficient liquidity

**Fallback:** If scanner fails, falls back to hardcoded watchlist with old scoring logic.

### 4. Position Management

**Entry:**
- Position size: 20% of max capital allocation per trade
- Minimum 1 share
- Market order execution

**Exit:**
- **Profit Target**: Default 1% gain (configurable)
- **Stop Loss**: Default 0.5% loss (configurable)
- **Auto Square-Off**: 15 minutes before market close (3:15 PM IST)

**Risk Controls:**
- Daily loss limit (halts trading if breached)
- Max 1 open position at a time
- Paper trading mode for testing

## API Endpoints

### Scan Stocks
```bash
POST /api/v1/scanner/scan
{
  "interval": "5minute",  # 1minute, 5minute, 15minute, 30minute
  "top_n": 5,
  "min_candles": 100
}
```

**Response:**
```json
{
  "top_stocks": [
    {
      "symbol": "NSE_EQ|INE002A01018",
      "intraday_score": 0.8234,
      "volatility": 0.0234,
      "volume_surge": 2.45,
      "trend_strength": 0.67,
      "ml_confidence": 0.89,
      "ml_signal": "BUY",
      "liquidity": 0.012,
      "momentum": 0.0145,
      "sector": "Energy"
    }
  ],
  "scanned_at": "2024-01-15T10:30:00Z",
  "interval": "5minute",
  "total_scanned": 5
}
```

### Get Latest Scan
```bash
GET /api/v1/scanner/latest?limit=10
```

## Database Schema

**stock_scores table:**
```sql
CREATE TABLE stock_scores (
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
  sector VARCHAR(50)
);
```

## Frontend Component

**Stock Scanner Dashboard** (`frontend/components/stock-scanner.tsx`):
- Real-time scan trigger
- Configurable interval (1min, 5min, 15min, 30min)
- Top N selection (3, 5, 10)
- Live ranking table with:
  - Composite score
  - Signal (BUY/SELL/HOLD)
  - Confidence percentage
  - Volatility, volume, trend, momentum
  - Sector classification

## Usage

### 1. Enable Auto-Trading with Scanner

```bash
POST /api/v1/trading/auto-trading/toggle
{
  "enabled": true,
  "paper_trading": true,
  "daily_loss_limit": 2000,
  "max_capital_allocation": 50000,
  "profit_target_pct": 1.0,
  "stop_loss_pct": 0.5
}
```

The auto-trader will now:
1. Scan the universe every cycle
2. Pick the best stock automatically
3. Enter position with BUY/SELL signal
4. Monitor and exit at target/stop-loss

### 2. Manual Scan (Dashboard)

1. Navigate to Stock Scanner panel
2. Select interval (5minute recommended for intraday)
3. Click "Scan Now"
4. View ranked stocks with scores
5. Auto-trader will use these results

### 3. Historical Analysis

Query past scans:
```bash
GET /api/v1/scanner/latest?limit=50
```

Analyze which stocks were selected and their performance.

## Configuration

### Adjust Stock Universe

Edit `backend/app/models/watchlist.py`:
```python
INTRADAY_UNIVERSE = [
    "NSE_EQ|INE002A01018",  # Add/remove stocks
    # ...
]
```

### Tune Scoring Weights

Edit `backend/app/services/stock_scanner.py`:
```python
def _calculate_score(self) -> float:
    score = (
        self.volatility * 0.25 +      # Adjust weights
        self.volume_surge * 0.25 +
        self.trend_strength * 0.20 +
        self.ml_confidence * 0.20 +
        (1 / max(self.liquidity, 0.01)) * 0.10
    )
```

### Change Scan Frequency

Edit `backend/app/services/auto_trader.py`:
```python
start_auto_trader(interval_seconds=900)  # 15 minutes
```

## Benefits vs Single-Stock Trading

| Aspect | Single Stock | Multi-Stock Scanner |
|--------|-------------|---------------------|
| Opportunity | Limited to 1 stock | Best of 30+ stocks |
| Diversification | None | Automatic rotation |
| Adaptability | Manual selection | AI-driven daily picks |
| Risk | Concentrated | Spread across sectors |
| Performance | Depends on 1 pick | Optimized selection |

## Intraday-Specific Features

1. **Time-based filters**: Only scans during market hours (9:15 AM - 3:15 PM IST)
2. **Intraday intervals**: Uses 1min, 5min, 15min candles (not daily)
3. **Auto square-off**: Closes all positions before 3:30 PM
4. **Margin-aware**: Respects intraday leverage limits
5. **Volume confirmation**: Prioritizes high-volume stocks for liquidity

## Monitoring

**Auto-Trader Status:**
```bash
GET /api/v1/trading/auto-trading/status
```

Returns:
- Currently held position
- Today's P&L
- Trade count
- Scanner status
- Last cycle time

**Logs:**
Check `_status["log"]` in auto-trader for:
- "Scanning stock universe..."
- "Scanner found X candidates"
- "BEST: [SYMBOL] | Score: X.XX | Signal: BUY"
- "ENTRY BUY [SYMBOL] x10 @ ₹123.45"

## Troubleshooting

**Scanner returns no results:**
- Check if historical candles are loaded for stocks
- Run `/api/v1/market/history/load` for each symbol
- Verify `min_candles` threshold (default 100)

**Auto-trader not using scanner:**
- Check logs for "Scanner failed" message
- Falls back to watchlist if scanner errors
- Verify MongoDB connection

**Low scores for all stocks:**
- Market may be range-bound (low volatility)
- Adjust scoring weights to prioritize different metrics
- Lower the score threshold in auto-trader

## Future Enhancements

- [ ] Pre-market gap scanner (9:00-9:15 AM)
- [ ] Sector rotation detection
- [ ] News sentiment integration
- [ ] Breakout pattern recognition
- [ ] Multi-position support (trade 3-5 stocks simultaneously)
- [ ] Backtesting scanner performance
- [ ] Real-time websocket updates for scores

## Summary

The stock scanner transforms the platform from a **single-stock predictor** to an **intelligent multi-stock selector**, automatically finding and trading the best intraday opportunities across the NSE universe. This maximizes profit potential while reducing risk through diversification and adaptive selection.
