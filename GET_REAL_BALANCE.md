# How to Get Real Balance from Upstox

## Problem
Your current token is an **extended_token** which:
- ✅ Works for: Market quotes, historical data, websocket
- ❌ Does NOT work for: Account balance, funds, user profile

The error you're seeing: `"The API you are trying to access is not permitted with an extended_token"`

## Solution: Get a Regular Access Token

### Step 1: Get Authorization URL
```bash
curl http://localhost:8000/api/v1/settings/upstox/auth-url
```

This will return:
```json
{
  "auth_url": "https://api-v2.upstox.com/login/authorization/dialog?client_id=47fcb645-e154-47e1-8369-b900adb1478b&redirect_uri=http://127.0.0.1:6000/callback&response_type=code"
}
```

### Step 2: Login via Browser
1. Open the `auth_url` in your browser
2. Login to Upstox
3. Authorize the app
4. You'll be redirected to: `http://127.0.0.1:6000/callback?code=XXXXXX`
5. Copy the `code` value from the URL

### Step 3: Exchange Code for Token
```bash
curl -X POST http://localhost:8000/api/v1/auth/upstox/exchange \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR_CODE_HERE"}'
```

This will give you BOTH:
- **access_token**: Regular 24-hour token (works with ALL APIs including balance)
- **extended_token**: Long-lived token (limited API access)

### Step 4: Verify Balance
```bash
curl http://localhost:8000/api/v1/account/funds
```

Now you'll see your real balance including the -354!

## Why This Happens

When you exchange an authorization code, Upstox returns:
```json
{
  "access_token": "eyJ0eXAi...",      // 24-hour token - FULL API access
  "extended_token": "eyJ0eXAi...",    // 1-year token - LIMITED API access
}
```

Your current token is the extended_token, which is why balance shows 0.

## Quick Fix (Temporary)

If you can't do OAuth right now, I can add a manual balance input feature where you enter your balance manually. But for real-time balance, you MUST use a regular access_token.

## Token Comparison

| Feature | Regular Access Token | Extended Token |
|---------|---------------------|----------------|
| Validity | 24 hours | ~1 year |
| Market Quotes | ✅ | ✅ |
| Historical Data | ✅ | ✅ |
| Websocket | ✅ | ✅ |
| **Account Balance** | ✅ | ❌ |
| User Profile | ✅ | ❌ |
| Place Orders | ✅ | ✅ |

## Alternative: Manual Balance Entry

If you want to see your balance without OAuth, I can add an endpoint:

```bash
POST /api/v1/account/set-balance
{
  "balance": -354,
  "source": "manual"
}
```

Would you like me to implement this?
