# Enhanced Auto Trading System

## 🚀 New Features

### 1. **Trailing Stop Loss**
Automatically locks in profits as the price moves in your favor.

- **How it works**: When a position is profitable, the stop loss automatically adjusts upward (for long positions) or downward (for short positions)
- **Default**: 0.5% trailing distance
- **Example**: If you buy at ₹100 and price moves to ₹102, the trailing stop moves to ₹101.49 (0.5% below current price)

### 2. **Multiple Concurrent Positions**
Trade multiple stocks simultaneously for better diversification.

- **Default**: Up to 3 positions at once
- **Benefit**: Reduces risk by not putting all capital in one stock
- **Smart allocation**: Capital is distributed across positions

### 3. **Advanced Risk Management**
Position sizing based on risk percentage rather than fixed capital.

- **Risk per trade**: Default 2% of total capital
- **Formula**: Position size = (Capital × Risk%) / (Entry Price × Stop Loss%)
- **Example**: With ₹50,000 capital, 2% risk, and 0.75% stop loss:
  - Risk amount = ₹1,000
  - If stock price = ₹100, stop distance = ₹0.75
  - Position size = ₹1,000 / ₹0.75 = 1,333 shares (capped at 20% of capital)

### 4. **Performance Analytics**
Real-time tracking of trading performance.

**Metrics tracked:**
- Win rate (%)
- Average win/loss
- Profit factor (total wins / total losses)
- Sharpe ratio (risk-adjusted returns)
- Maximum drawdown
- Daily P&L breakdown

### 5. **Trade Limits**
Prevent overtrading and manage risk.

- **Max trades per day**: Default 10 trades
- **Daily loss limit**: Stops trading if limit hit
- **Position limits**: Max concurrent positions

## 📊 Configuration Parameters

### Basic Settings
```json
{
  "enabled": true,
  "paper_trading": true,
  "max_capital_allocation": 50000,
  "daily_loss_limit": 2000
}
```

### Advanced Settings
```json
{
  "profit_target_pct": 1.5,        // Take profit at 1.5%
  "stop_loss_pct": 0.75,           // Stop loss at 0.75%
  "trailing_stop_enabled": true,   // Enable trailing stops
  "trailing_stop_pct": 0.5,        // Trail by 0.5%
  "max_positions": 3,              // Max 3 concurrent positions
  "risk_per_trade_pct": 2.0,       // Risk 2% per trade
  "max_trades_per_day": 10         // Max 10 trades per day
}
```

## 🔧 API Endpoints

### 1. Toggle Auto Trading
```bash
POST /api/v1/trading/auto-trading/toggle
Content-Type: application/json

{
  "enabled": true,
  "paper_trading": true,
  "daily_loss_limit": 2000,
  "max_capital_allocation": 50000,
  "profit_target_pct": 1.5,
  "stop_loss_pct": 0.75,
  "trailing_stop_enabled": true,
  "trailing_stop_pct": 0.5,
  "max_positions": 3,
  "risk_per_trade_pct": 2.0,
  "max_trades_per_day": 10
}
```

### 2. Get Status
```bash
GET /api/v1/trading/auto-trading/status
```

**Response:**
```json
{
  "enabled": true,
  "paper_trading": true,
  "today_trades": 5,
  "today_pnl": 1250.50,
  "loop": {
    "running": true,
    "cycles": 120,
    "active_position": {
      "instrument": "RELIANCE",
      "entry": 2450.00,
      "current": 2465.00,
      "qty": 20,
      "pnl": 300.00,
      "pnl_pct": 0.61
    },
    "win_rate": 65.5,
    "total_wins": 8,
    "total_losses": 4,
    "avg_win": 250.00,
    "avg_loss": -120.00,
    "max_drawdown": 450.00,
    "sharpe_ratio": 1.85,
    "trailing_stop_active": true
  }
}
```

### 3. Get Performance Analytics
```bash
GET /api/v1/trading/auto-trading/performance?days=30
```

**Response:**
```json
{
  "total_trades": 45,
  "winning_trades": 28,
  "losing_trades": 17,
  "win_rate": 62.22,
  "total_pnl": 5420.50,
  "avg_win": 285.50,
  "avg_loss": -145.20,
  "max_win": 850.00,
  "max_loss": -320.00,
  "profit_factor": 2.15,
  "sharpe_ratio": 1.92,
  "max_drawdown": 680.00,
  "best_day": {
    "date": "2026-03-20",
    "pnl": 1250.00
  },
  "worst_day": {
    "date": "2026-03-15",
    "pnl": -450.00
  },
  "daily_pnl": [
    {"date": "2026-03-01", "pnl": 250.00},
    {"date": "2026-03-02", "pnl": -120.00},
    ...
  ],
  "period_days": 30
}
```

## 🎯 Trading Strategy

### Entry Logic
1. **Stock Scanner**: Scans universe of 30+ liquid NSE stocks
2. **Multi-factor Scoring**:
   - RSI (14 & 7 period)
   - MACD crossover
   - Moving averages (SMA 20/50, EMA 12/20)
   - Bollinger Bands position
   - Volume surge detection
   - ADX trend strength
   - Multi-timeframe momentum

3. **Signal Generation**:
   - BUY: RSI < 65, MACD bullish, positive momentum, volume surge
   - SELL: RSI > 35, MACD bearish, negative momentum
   - Minimum score: 50/100 for entry

### Position Management
1. **Entry**: Risk-based position sizing
2. **Monitoring**: Real-time price tracking every 60 seconds
3. **Exit Conditions**:
   - Profit target hit (default 1.5%)
   - Stop loss hit (default 0.75%)
   - Trailing stop triggered
   - Daily loss limit reached
   - Max trades per day reached

### Risk Controls
- **Position sizing**: Based on risk percentage
- **Stop loss**: Automatic on every trade
- **Trailing stops**: Lock in profits
- **Daily limits**: Prevent overtrading
- **Max positions**: Diversification
- **Capital allocation**: Max 20% per position

## 📈 Performance Metrics Explained

### Win Rate
Percentage of profitable trades.
- **Good**: > 55%
- **Excellent**: > 65%

### Profit Factor
Total profits / Total losses.
- **Good**: > 1.5
- **Excellent**: > 2.0

### Sharpe Ratio
Risk-adjusted returns (higher is better).
- **Good**: > 1.0
- **Excellent**: > 2.0

### Max Drawdown
Largest peak-to-trough decline.
- **Good**: < 10% of capital
- **Acceptable**: < 20% of capital

## 🛡️ Safety Features

1. **Paper Trading Mode**: Test strategies without real money
2. **Daily Loss Limit**: Auto-stops if limit hit
3. **Position Limits**: Prevents over-concentration
4. **Trade Limits**: Prevents overtrading
5. **Trailing Stops**: Protects profits
6. **Risk-based Sizing**: Consistent risk per trade

## 🔍 Monitoring

### Real-time Status
Check `/api/v1/trading/auto-trading/status` for:
- Current positions
- Today's P&L
- Active trailing stops
- Performance metrics

### Logs
The system maintains last 20 log entries showing:
- Entry/exit signals
- Position updates
- Risk events
- System status

## 💡 Best Practices

1. **Start with Paper Trading**: Test the system before going live
2. **Conservative Settings**: Start with lower risk (1-2% per trade)
3. **Monitor Daily**: Check performance and adjust parameters
4. **Respect Limits**: Don't override daily loss limits
5. **Diversify**: Use multiple positions (3-5)
6. **Review Performance**: Analyze weekly/monthly metrics
7. **Adjust Parameters**: Fine-tune based on market conditions

## 🚨 Important Notes

- **Market Hours**: Auto trading only works during market hours (9:15 AM - 3:30 PM IST)
- **Token Validity**: Ensure Upstox token is valid (check `/api/v1/settings/upstox/status`)
- **Capital Requirements**: Minimum ₹10,000 recommended for effective diversification
- **Network**: Stable internet connection required
- **Monitoring**: Regular monitoring recommended even with auto trading

## 🔄 Upgrade from Old System

### What's New
- ✅ Trailing stops (was: fixed stops only)
- ✅ Multiple positions (was: single position)
- ✅ Risk-based sizing (was: fixed percentage)
- ✅ Performance analytics (was: basic stats)
- ✅ Trade limits (was: unlimited)
- ✅ Enhanced scoring (was: basic indicators)

### Migration
Existing configurations will use default values for new parameters:
- `trailing_stop_enabled`: true
- `trailing_stop_pct`: 0.5
- `max_positions`: 3
- `risk_per_trade_pct`: 2.0
- `max_trades_per_day`: 10

## 📞 Support

For issues or questions:
1. Check logs: `/api/v1/trading/auto-trading/status`
2. Review performance: `/api/v1/trading/auto-trading/performance`
3. Verify token: `/api/v1/settings/upstox/status`
4. Check trades: `/api/v1/trades/history`

## 🎓 Example Configuration

### Conservative (Low Risk)
```json
{
  "profit_target_pct": 1.0,
  "stop_loss_pct": 0.5,
  "trailing_stop_pct": 0.3,
  "max_positions": 2,
  "risk_per_trade_pct": 1.0,
  "max_trades_per_day": 5
}
```

### Moderate (Balanced)
```json
{
  "profit_target_pct": 1.5,
  "stop_loss_pct": 0.75,
  "trailing_stop_pct": 0.5,
  "max_positions": 3,
  "risk_per_trade_pct": 2.0,
  "max_trades_per_day": 10
}
```

### Aggressive (High Risk)
```json
{
  "profit_target_pct": 2.0,
  "stop_loss_pct": 1.0,
  "trailing_stop_pct": 0.75,
  "max_positions": 5,
  "risk_per_trade_pct": 3.0,
  "max_trades_per_day": 15
}
```

---

**Happy Trading! 🚀📈**
