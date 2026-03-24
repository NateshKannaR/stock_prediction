# Upstox Extended Token Fix - Summary

## Problem Identified

The extended_token in MongoDB was not working for automatic token refresh because:

1. **Upstox extended_token cannot be used to automatically refresh access_token**
   - Extended tokens in Upstox API v2 have limited API access
   - They cannot be used with the `/login/authorization/token` endpoint to get new access tokens
   - Attempting to use them results in error: "The API you are trying to access is not permitted with an extended_token"

2. **Misunderstanding of extended_token purpose**
   - Extended tokens are long-lived (~1 year validity) but have restricted API access
   - They are NOT meant for automatic token refresh
   - Regular access_token expires after ~24 hours and requires manual re-authentication

## Solution Implemented

### 1. Fixed `UpstoxService.get_credential()` method
- Now uses regular `access_token` for API calls (not extended_token)
- Checks token expiry and raises clear error when expired
- Provides helpful message about re-authentication requirement

### 2. Fixed `UpstoxService.exchange_code()` method
- Ensures `expires_at` is always set (defaults to 24 hours if not provided by API)
- Properly stores both `access_token` and `extended_token`

### 3. Added `UpstoxService.get_token_status()` method
- Returns detailed token status including:
  - Whether token is configured
  - Whether token is expired
  - Expiry timestamp
  - Time remaining in seconds and hours
  - Whether extended_token is available

### 4. Updated API routes
- `/api/v1/auth/upstox/refresh` - Now checks token status instead of attempting refresh
- `/api/v1/settings/upstox/status` - Returns detailed token status

## Current Status

Your Upstox token has **expired** because:
- Token was created: January 16, 2025
- Token expires: March 20, 2026 22:00:00 UTC
- Current system time: March 24, 2026 21:47:57 IST
- **Token expired 4 days ago** (based on system clock)

## Action Required

You need to **re-authenticate with Upstox** to get a new access_token:

1. Get the authorization URL:
   ```bash
   curl http://localhost:8000/api/v1/settings/upstox/auth-url
   ```

2. Open the URL in browser and complete Upstox login

3. Copy the authorization code from the redirect URL

4. Exchange the code for tokens:
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/upstox/exchange \
     -H "Content-Type: application/json" \
     -d '{"code": "YOUR_AUTH_CODE_HERE"}'
   ```

## Key Takeaways

1. **Upstox extended_token cannot auto-refresh** - This is a limitation of Upstox API v2
2. **Manual re-authentication required** - When access_token expires (~24 hours), user must login again
3. **System clock issue** - Your system clock is set to 2026, which may cause issues with token validation
4. **Token status endpoint** - Use `/api/v1/settings/upstox/status` to check token validity

## Files Modified

1. `/home/natesh/Quant_Stock/backend/app/services/upstox.py`
   - Fixed `get_credential()` to use access_token correctly
   - Fixed `exchange_code()` to set proper expiry
   - Added `get_token_status()` method
   - Updated `refresh_access_token()` with clarifying comments

2. `/home/natesh/Quant_Stock/backend/app/api/routes.py`
   - Updated `/auth/upstox/refresh` endpoint
   - Updated `/settings/upstox/status` endpoint

## Testing

Run this to check token status:
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
    print('Token Status:', status)

asyncio.run(check())
"
```
