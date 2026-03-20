# Stock Scanner Quick Start Guide

## Prerequisites

✅ Backend running on port 8000  
✅ MongoDB connected  
✅ Upstox credentials configured  
✅ Historical data loaded (see step 1)

## Step 1: Load Historical Data

Load candles for all 30 stocks in the universe:

```bash
cd /home/natesh/Quant_Stock
python scripts/load_scanner_universe.py --interval 5minute --days 30
```

**Expected output:**
```
📊 Loading 5minute candles for 30 stocks
📅 Date range: 2024-12-15 to 2024-01-15

[1/30] NSE_EQ|INE002A01018... ✓ Loaded 1234 candles
[2/30] NSE_EQ|INE467B01029... ✓ Loaded 1156 candles
...
✅ Complete: 28 success, 2 failed
🚀 Ready to use stock scanner!
```

**Time**: ~30-60 seconds (rate-limited to 1 req/sec)

## Step 2: Test Scanner (API)

Trigger a manual scan:

```bash
curl -X POST http://localhost:8000/api/v1/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{
    "interval": "5minute",
    "top_n": 5,
    "min_candles": 100
  }'
```

**Expected response:**
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

## Step 3: View in Dashboard

1. Open frontend: `http://localhost:3000`
2. Navigate to **Stock Scanner** panel
3. Select interval: **5 Min**
4. Select top N: **5**
5. Click **"Scan Now"**
6. View ranked stocks table

## Step 4: Enable Auto-Trading

Start automated trading with scanner:

```bash
curl -X POST http://localhost:8000/api/v1/trading/auto-trading/toggle \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "paper_trading": true,
    "daily_loss_limit": 2000,
    "max_capital_allocation": 50000,
    "profit_target_pct": 1.0,
    "stop_loss_pct": 0.5
  }'
```

**What happens:**
- Auto-trader runs every 30 seconds
- Scans universe every cycle
- Picks best stock with BUY/SELL signal
- Enters position (20% of ₹50,000 = ₹10,000)
- Exits at 1% profit or 0.5% loss
- Stops if daily loss hits ₹2,000

## Step 5: Monitor Trading

Check auto-trader status:

```bash
curl http://localhost:8000/api/v1/trading/auto-trading/status
```

**Response:**
```json
{
  "enabled": true,
  "paper_trading": true,
  "today_trades": 3,
  "today_pnl": 450.50,
  "loop": {
    "running": true,
    "last_cycle": "2024-01-15T10:35:00Z",
    "cycles": 42,
    "active_position": {
      "instrument": "RELIANCE",
      "entry": 2450.50,
      "current": 2465.75,
      "qty": 4,
      "pnl": 61.00,
      "pnl_pct": 0.62
    },
    "log": [
      {"t": "10:35:12", "msg": "Scanning stock universe..."},
      {"t": "10:35:15", "msg": "Scanner found 5 candidates"},
      {"t": "10:35:16", "msg": "BEST: RELIANCE | Score: 0.82 | Signal: BUY"}
    ]
  }
}
```

## Step 6: View Trade History

```bash
curl http://localhost:8000/api/v1/trades/history
```

## Common Commands

### Scan with different intervals
```bash
# 1-minute candles (high frequency)
curl -X POST http://localhost:8000/api/v1/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{"interval": "1minute", "top_n": 3}'

# 15-minute candles (swing intraday)
curl -X POST http://localhost:8000/api/v1/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{"interval": "15minute", "top_n": 5}'
```

### Get latest scan results
```bash
curl http://localhost:8000/api/v1/scanner/latest?limit=10
```

### Stop auto-trading
```bash
curl -X POST http://localhost:8000/api/v1/trading/auto-trading/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled": false, "paper_trading": true, "daily_loss_limit": 0, "max_capital_allocation": 0}'
```

## Verification Checklist

- [ ] Historical data loaded for 30 stocks
- [ ] Scanner returns top 5 stocks
- [ ] Scores are between 0-1
- [ ] Signals are BUY/SELL/HOLD
- [ ] Auto-trader status shows "running": true
- [ ] Logs show "Scanning stock universe..."
- [ ] Positions appear in portfolio
- [ ] Trades recorded in history

## Troubleshooting

### "No scan results"
**Cause**: No historical data  
**Fix**: Run `load_scanner_universe.py`

### "Scanner failed"
**Cause**: MongoDB connection issue  
**Fix**: Check `MONGODB_URL` in `.env`

### "No strong opportunity found"
**Cause**: Market is range-bound  
**Fix**: Normal behavior, wait for next cycle

### "Daily loss limit hit"
**Cause**: Lost ₹2,000 today  
**Fix**: Auto-trading disabled for safety, re-enable tomorrow

## Tips

1. **Start with paper trading** to test without risk
2. **Monitor for 1-2 days** before going live
3. **Check logs regularly** to understand decisions
4. **Adjust weights** if scores don't match expectations
5. **Use 5-minute interval** for balanced intraday trading
6. **Set realistic targets**: 1% profit, 0.5% stop-loss

## Next Steps

1. ✅ Load data → Test scanner → Enable auto-trading
2. Monitor performance for 1 week
3. Analyze which stocks were selected
4. Tune scoring weights based on results
5. Switch to live trading when confident

## Support

- Full docs: `STOCK_SCANNER.md`
- Implementation: `SCANNER_IMPLEMENTATION.md`
- Issues: Check auto-trader logs in status endpoint

---

**Ready to trade smarter with AI-powered stock selection! 🚀**
