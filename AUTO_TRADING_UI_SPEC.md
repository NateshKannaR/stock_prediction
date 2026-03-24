# Professional Auto Trading Dashboard - API Specification

## Overview
This document specifies the API endpoints needed for a professional auto trading dashboard with comprehensive information display.

## 1. Dashboard Overview Endpoint

### GET /api/v1/trading/dashboard/overview

**Purpose**: Get complete dashboard data in one call

**Response**:
```json
{
  "status": {
    "enabled": true,
    "running": true,
    "paper_trading": true,
    "last_cycle": "2026-03-24T16:30:00Z",
    "cycles_completed": 145,
    "uptime_minutes": 87
  },
  "capital": {
    "total_allocated": 50000.00,
    "available": 42350.00,
    "in_positions": 7650.00,
    "utilization_pct": 15.3
  },
  "today": {
    "trades": 5,
    "pnl": 1250.50,
    "pnl_pct": 2.5,
    "wins": 3,
    "losses": 2,
    "win_rate": 60.0
  },
  "active_positions": [
    {
      "stock": "RELIANCE",
      "instrument_key": "NSE_EQ|INE002A01018",
      "side": "BUY",
      "quantity": 4,
      "entry_price": 2450.00,
      "current_price": 2465.00,
      "pnl": 60.00,
      "pnl_pct": 0.61,
      "entry_time": "2026-03-24T15:30:00Z",
      "duration_minutes": 60,
      "stop_loss": 2431.63,
      "target": 2486.75,
      "trailing_stop": 2458.50,
      "trailing_active": true
    }
  ],
  "performance": {
    "total_trades": 45,
    "win_rate": 62.22,
    "profit_factor": 2.15,
    "sharpe_ratio": 1.92,
    "max_drawdown": 680.00,
    "avg_win": 285.50,
    "avg_loss": -145.20,
    "total_pnl": 5420.50
  },
  "risk_metrics": {
    "daily_loss_limit": 2000.00,
    "daily_loss_used": 0.00,
    "daily_loss_remaining": 2000.00,
    "max_positions": 3,
    "current_positions": 1,
    "max_trades_per_day": 10,
    "trades_today": 5,
    "trades_remaining": 5
  }
}
```

## 2. Live Stock Analysis Endpoint

### GET /api/v1/trading/analysis/live

**Purpose**: Get real-time stock analysis with detailed scoring

**Response**:
```json
{
  "scan_timestamp": "2026-03-24T16:30:00Z",
  "stocks_analyzed": 30,
  "candidates_found": 8,
  "top_candidates": [
    {
      "rank": 1,
      "stock": "RELIANCE",
      "instrument_key": "NSE_EQ|INE002A01018",
      "price": 2450.00,
      "total_score": 78.5,
      "signal": "BUY",
      "confidence": 82,
      "score_breakdown": {
        "rsi": {
          "score": 25,
          "max": 25,
          "value": 52.3,
          "status": "Optimal range (35-65)",
          "interpretation": "Active momentum, not overbought"
        },
        "macd": {
          "score": 25,
          "max": 25,
          "value": 0.0045,
          "signal_value": 0.0032,
          "crossover": "bullish",
          "status": "Bullish crossover detected",
          "interpretation": "Strong buy signal from trend reversal"
        },
        "trend": {
          "score": 20,
          "max": 20,
          "sma_20": 2420.00,
          "sma_50": 2380.00,
          "status": "Strong uptrend",
          "interpretation": "Price above all moving averages"
        },
        "bollinger": {
          "score": 10,
          "max": 15,
          "position_pct": 45.2,
          "bb_high": 2480.00,
          "bb_low": 2420.00,
          "status": "Middle range",
          "interpretation": "Balanced position, room to move"
        },
        "volume": {
          "score": 15,
          "max": 15,
          "current": 1850000,
          "average": 1025000,
          "ratio": 1.8,
          "status": "High volume surge",
          "interpretation": "Strong institutional interest"
        }
      },
      "technical_indicators": {
        "rsi_14": 52.3,
        "rsi_7": 54.1,
        "macd": 0.0045,
        "macd_signal": 0.0032,
        "macd_histogram": 0.0013,
        "sma_20": 2420.00,
        "sma_50": 2380.00,
        "ema_20": 2435.00,
        "ema_12": 2442.00,
        "bb_upper": 2480.00,
        "bb_middle": 2450.00,
        "bb_lower": 2420.00,
        "atr_14": 35.50,
        "adx_14": 28.5,
        "volume_ratio": 1.8
      },
      "position_recommendation": {
        "suggested_quantity": 4,
        "suggested_cost": 9800.00,
        "capital_allocation_pct": 19.6,
        "risk_amount": 1000.00,
        "risk_pct": 2.0
      },
      "risk_reward": {
        "entry": 2450.00,
        "stop_loss": 2431.63,
        "stop_loss_pct": 0.75,
        "target": 2486.75,
        "target_pct": 1.5,
        "risk_amount": 73.48,
        "reward_amount": 147.00,
        "risk_reward_ratio": "1:2"
      },
      "reasoning": [
        "High total score of 78.5/100 indicates strong opportunity",
        "RSI at 52.3 shows healthy momentum without overbought conditions",
        "MACD bullish crossover signals trend reversal",
        "Price above SMA 20 and SMA 50 confirms uptrend",
        "Volume 1.8x average shows strong buying interest",
        "Bollinger position at 45% provides room for upward movement"
      ],
      "momentum": {
        "intraday_change_pct": 0.85,
        "3day_change_pct": 2.3,
        "7day_change_pct": 5.1,
        "trend_strength": "strong"
      }
    }
  ]
}
```

## 3. Decision Log Endpoint

### GET /api/v1/trading/decisions/detailed

**Purpose**: Get detailed decision history with full reasoning

**Response**:
```json
{
  "decisions": [
    {
      "id": "dec_001",
      "timestamp": "2026-03-24T15:30:00Z",
      "type": "ENTRY",
      "action": "BUY",
      "stock": "RELIANCE",
      "instrument_key": "NSE_EQ|INE002A01018",
      "decision_summary": "Entered BUY position in RELIANCE based on strong technical setup",
      "analysis": {
        "total_score": 78.5,
        "confidence": 82,
        "signal_strength": "STRONG"
      },
      "execution": {
        "quantity": 4,
        "price": 2450.00,
        "total_cost": 9800.00,
        "status": "FILLED",
        "order_id": "paper-001"
      },
      "reasoning": {
        "primary_factors": [
          "MACD bullish crossover (25/25 points)",
          "RSI in optimal range 52.3 (25/25 points)",
          "Strong uptrend confirmed (20/20 points)"
        ],
        "supporting_factors": [
          "High volume surge 1.8x average",
          "Price above all moving averages",
          "Positive momentum +0.85%"
        ],
        "risk_assessment": "Low risk with 1:2 risk/reward ratio"
      },
      "expected_outcome": {
        "target_price": 2486.75,
        "target_pct": 1.5,
        "stop_loss": 2431.63,
        "stop_loss_pct": 0.75,
        "expected_profit": 147.00,
        "max_loss": 73.48
      }
    },
    {
      "id": "dec_002",
      "timestamp": "2026-03-24T16:15:00Z",
      "type": "EXIT",
      "action": "SELL",
      "stock": "RELIANCE",
      "instrument_key": "NSE_EQ|INE002A01018",
      "decision_summary": "Exited position - Profit target reached",
      "execution": {
        "quantity": 4,
        "price": 2487.00,
        "total_value": 9948.00,
        "status": "FILLED",
        "order_id": "paper-002"
      },
      "outcome": {
        "entry_price": 2450.00,
        "exit_price": 2487.00,
        "pnl": 148.00,
        "pnl_pct": 1.51,
        "holding_period_minutes": 45,
        "exit_reason": "Profit target reached (1.5%)"
      },
      "performance": {
        "vs_target": "Achieved",
        "vs_stop_loss": "Not triggered",
        "trailing_stop_used": false,
        "result": "WIN"
      }
    }
  ],
  "summary": {
    "total_decisions": 45,
    "entries": 23,
    "exits": 22,
    "wins": 14,
    "losses": 8,
    "no_trades": 1
  }
}
```

## 4. Real-Time Logs Endpoint

### GET /api/v1/trading/logs/live

**Purpose**: Get real-time system logs with color coding

**Response**:
```json
{
  "logs": [
    {
      "timestamp": "2026-03-24T16:30:15Z",
      "time": "16:30:15",
      "level": "SUCCESS",
      "category": "ENTRY",
      "message": "ENTRY BUY RELIANCE x4 @ ₹2,450.00 [PAPER]",
      "details": {
        "stock": "RELIANCE",
        "action": "BUY",
        "quantity": 4,
        "price": 2450.00,
        "cost": 9800.00
      }
    },
    {
      "timestamp": "2026-03-24T16:30:10Z",
      "time": "16:30:10",
      "level": "INFO",
      "category": "ANALYSIS",
      "message": "BEST: RELIANCE | Score: 78.5 | Signal: BUY | ₹2,450.00 x 4 = ₹9,800.00",
      "details": {
        "stock": "RELIANCE",
        "score": 78.5,
        "signal": "BUY"
      }
    },
    {
      "timestamp": "2026-03-24T16:30:05Z",
      "time": "16:30:05",
      "level": "INFO",
      "category": "SCAN",
      "message": "Scanner found 8 candidates",
      "details": {
        "candidates": 8
      }
    },
    {
      "timestamp": "2026-03-24T16:30:00Z",
      "time": "16:30:00",
      "level": "INFO",
      "category": "CYCLE",
      "message": "=== Starting Trading Cycle ===",
      "details": {
        "cycle": 145
      }
    }
  ]
}
```

## 5. Performance Charts Endpoint

### GET /api/v1/trading/charts/performance

**Purpose**: Get data for performance visualization charts

**Response**:
```json
{
  "equity_curve": [
    {"timestamp": "2026-03-24T09:00:00Z", "value": 50000.00},
    {"timestamp": "2026-03-24T10:00:00Z", "value": 50250.00},
    {"timestamp": "2026-03-24T11:00:00Z", "value": 50180.00},
    {"timestamp": "2026-03-24T12:00:00Z", "value": 50420.00}
  ],
  "daily_pnl": [
    {"date": "2026-03-18", "pnl": 250.00, "trades": 3},
    {"date": "2026-03-19", "pnl": -120.00, "trades": 2},
    {"date": "2026-03-20", "pnl": 450.00, "trades": 4},
    {"date": "2026-03-21", "pnl": 180.00, "trades": 3},
    {"date": "2026-03-24", "pnl": 1250.50, "trades": 5}
  ],
  "win_loss_distribution": {
    "wins": [250, 180, 320, 450, 280, 190, 350],
    "losses": [-120, -95, -150, -110, -85]
  },
  "score_distribution": [
    {"range": "0-20", "count": 2},
    {"range": "20-40", "count": 5},
    {"range": "40-60", "count": 12},
    {"range": "60-80", "count": 8},
    {"range": "80-100", "count": 3}
  ],
  "indicator_performance": {
    "rsi": {"avg_score": 18.5, "max": 25},
    "macd": {"avg_score": 16.2, "max": 25},
    "trend": {"avg_score": 14.8, "max": 20},
    "bollinger": {"avg_score": 9.5, "max": 15},
    "volume": {"avg_score": 11.2, "max": 15}
  }
}
```

## UI Components Needed

### 1. Dashboard Header
- System status (Running/Stopped)
- Mode (Paper/Live)
- Current cycle info
- Quick stats (Today's P&L, Win Rate)

### 2. Capital Overview Card
- Total allocated capital
- Available capital
- Capital in positions
- Utilization gauge

### 3. Active Positions Table
- Stock name with logo
- Entry price & current price
- P&L with color coding
- Stop loss & target levels
- Trailing stop indicator
- Duration timer
- Quick exit button

### 4. Live Stock Analysis Panel
- Top 5 candidates with scores
- Score breakdown visualization (radar chart)
- Technical indicators table
- Signal strength meter
- Reasoning bullets
- "Why this stock?" explanation

### 5. Decision Log Timeline
- Chronological decision history
- Entry/Exit markers
- Detailed reasoning expandable
- Outcome indicators (Win/Loss)
- Filter by type/stock

### 6. Performance Dashboard
- Equity curve chart
- Daily P&L bar chart
- Win/Loss distribution
- Key metrics cards
- Score distribution histogram

### 7. Real-Time Logs Panel
- Color-coded log entries
- Auto-scroll option
- Filter by level/category
- Export logs button

### 8. Risk Metrics Panel
- Daily loss limit gauge
- Position limit indicator
- Trade limit counter
- Risk exposure breakdown

## Color Scheme

```css
/* Status Colors */
--success: #10b981  /* Green for wins, buy signals */
--danger: #ef4444   /* Red for losses, sell signals */
--warning: #f59e0b  /* Orange for warnings */
--info: #3b82f6     /* Blue for info */
--neutral: #6b7280  /* Gray for neutral */

/* Score Colors */
--score-excellent: #10b981  /* 80-100 */
--score-good: #3b82f6       /* 60-80 */
--score-fair: #f59e0b       /* 40-60 */
--score-poor: #ef4444       /* 0-40 */
```

## Implementation Priority

1. **Phase 1**: Dashboard overview + Active positions
2. **Phase 2**: Live stock analysis + Decision log
3. **Phase 3**: Performance charts + Real-time logs
4. **Phase 4**: Risk metrics + Advanced filters
