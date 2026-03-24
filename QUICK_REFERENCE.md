# Extended Token Quick Reference

## ✅ System Status: WORKING

Your extended_token is configured and valid for **360 days** (until March 19, 2027).

## Quick Commands

### Check Token Status
```bash
cd /home/natesh/Quant_Stock/backend
source .venv/bin/activate
python3 -c "
import asyncio
import sys
sys.path.insert(0, '.')
from app.db.session import get_db
from app.services.upstox import UpstoxService

async def check():
    db = await get_db()
    upstox = UpstoxService(db)
    user = await db['users'].find_one({'email': 'admin@benx.local'})
    status = await upstox.get_token_status(str(user['_id']))
    print(f\"Expired: {status['expired']}\")
    print(f\"Days remaining: {status.get('time_remaining_hours', 0) / 24:.1f}\")

asyncio.run(check())
"
```

### Start Backend Server
```bash
cd /home/natesh/Quant_Stock/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Test API Call
```bash
# After server is running
curl -X POST http://localhost:8000/api/v1/market/quotes \
  -H "Content-Type: application/json" \
  -d '{"instrument_keys": ["NSE_EQ|INE002A01018"]}'
```

## What Changed

### Before (Broken)
- ❌ Tried to use extended_token to refresh access_token
- ❌ Failed with "not permitted" errors
- ❌ Token expiry not properly tracked

### After (Fixed)
- ✅ Uses extended_token directly for API calls
- ✅ Properly tracks expiry (360 days)
- ✅ Clear error messages when expired
- ✅ Works with all trading APIs

## Key Points

1. **Extended token works for trading APIs** (quotes, candles, websocket)
2. **Valid for 1 year** - no refresh needed until March 2027
3. **Stored in MongoDB** - `upstox_credentials` collection
4. **Auto-expiry check** - System validates before each API call

## MongoDB Document Structure

```javascript
{
  "_id": ObjectId("..."),
  "user_id": "69b8d98193f725f9c2474375",
  "access_token": "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIi...",
  "extended_token": "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIi...",
  "expires_at": ISODate("2027-03-19T22:00:00.000Z"),
  "updated_at": ISODate("2026-03-24T...")
}
```

## Troubleshooting

### If token expires
```bash
# Get auth URL
curl http://localhost:8000/api/v1/settings/upstox/auth-url

# After browser login, exchange code
curl -X POST http://localhost:8000/api/v1/auth/upstox/exchange \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR_CODE_HERE"}'
```

### Check logs
```bash
cd /home/natesh/Quant_Stock/backend
source .venv/bin/activate
uvicorn app.main:app --log-level debug
```

## Next Steps

Your system is ready! You can now:
1. ✅ Start the backend server
2. ✅ Start the frontend
3. ✅ Fetch market data
4. ✅ Run predictions
5. ✅ Execute trades

No further action needed for token management until March 2027.
