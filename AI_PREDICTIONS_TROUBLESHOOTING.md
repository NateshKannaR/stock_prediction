# AI Predictions Troubleshooting Guide

## Issue
AI Predictions page is not showing anything after backend update.

## Diagnosis

### Backend Status ✅
- Backend server is running on port 8000
- API endpoint `/api/v1/predictions/signals` is working
- Returns 27 predictions (out of 30 stocks)
- 3 stocks might not have enough historical data

### Test Backend Directly
```bash
# Test if backend is returning data
curl http://localhost:8000/api/v1/predictions/signals | jq 'length'
# Should return: 27

# View first prediction
curl http://localhost:8000/api/v1/predictions/signals | jq '.[0]'
```

## Common Solutions

### Solution 1: Hard Refresh Browser (Most Common)
1. Open the AI Predictions page
2. Press **Ctrl + Shift + R** (Linux/Windows) or **Cmd + Shift + R** (Mac)
3. This clears the cache and reloads the page

### Solution 2: Clear Browser Cache
1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Clear storage** or **Clear site data**
4. Refresh the page

### Solution 3: Check Browser Console
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for any red error messages
4. Common errors:
   - CORS errors
   - Network errors
   - JavaScript errors

### Solution 4: Check Network Tab
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Refresh the page
4. Look for the request to `/api/v1/predictions/signals`
5. Check if:
   - Request is being made
   - Response status is 200
   - Response contains data

### Solution 5: Restart Frontend Server
```bash
# Stop the frontend (Ctrl+C in the terminal)
cd frontend
npm run dev
```

### Solution 6: Check API Base URL
The frontend should be calling `http://localhost:8000/api/v1`

Check in browser console:
```javascript
// In browser console, type:
fetch('http://localhost:8000/api/v1/predictions/signals')
  .then(r => r.json())
  .then(data => console.log('Predictions:', data.length))
```

Should log: `Predictions: 27`

### Solution 7: Verify Frontend Code
Check if the AI predictions page is calling the API:

File: `frontend/app/(dashboard)/ai-predictions/page.tsx`

The `load()` function should be:
```typescript
async function load() {
  setLoading(true);
  try {
    const res = await api.predictions();
    setPredictions(res);
  } catch (e) {
    console.error("Predictions error:", e);
  }
  setLoading(false);
}
```

## Debugging Steps

### Step 1: Check if data is loading
1. Open AI Predictions page
2. Open browser console (F12)
3. Look for the log: `"Predictions error:"` 
4. If you see this, there's an API error

### Step 2: Check loading state
The page should show:
- Loading skeleton (6 animated cards) while fetching
- Predictions cards after loading
- Empty state if no predictions

### Step 3: Check filters
Make sure you're not filtering out all results:
- Check if "ALL" filter is selected
- Check if search box is empty
- Try clicking "ALL" button

### Step 4: Manual API test in browser
1. Open browser console
2. Run:
```javascript
fetch('http://localhost:8000/api/v1/predictions/signals')
  .then(r => r.json())
  .then(data => {
    console.log('Total predictions:', data.length);
    console.log('First prediction:', data[0]);
  })
  .catch(err => console.error('Error:', err));
```

## Expected Behavior

### When Working Correctly
1. Page loads with "Loading..." skeletons
2. After 2-5 seconds, prediction cards appear
3. Shows 27 prediction cards (3 stocks might be missing data)
4. Each card shows:
   - Stock name (e.g., "RELIANCE")
   - Current price
   - BUY/SELL/HOLD signal
   - Confidence percentage
   - Target price and stop loss
   - Technical indicators

### Missing Stocks
These 3 stocks might not show if they don't have enough historical data:
- Check which stocks are missing
- Load historical data for them manually
- Use the "Load History" feature in Live Market page

## Quick Fix Commands

### Restart Everything
```bash
# Terminal 1: Restart Backend
cd backend
# Press Ctrl+C to stop
uvicorn app.main:app --reload --port 8000

# Terminal 2: Restart Frontend
cd frontend
# Press Ctrl+C to stop
npm run dev
```

### Clear All Caches
```bash
# Clear Next.js cache
cd frontend
rm -rf .next
npm run dev
```

## Still Not Working?

### Check These Files
1. `frontend/lib/api.ts` - API configuration
2. `frontend/app/(dashboard)/ai-predictions/page.tsx` - Page component
3. `backend/app/api/routes.py` - Backend routes

### Verify Backend Changes
```bash
# Check if backend has all 30 stocks
grep -A 10 "prediction_signals" backend/app/api/routes.py | grep "NSE_EQ" | wc -l
# Should return: 30
```

### Check Frontend API Call
```bash
# Check if frontend is using correct API
grep "predictions:" frontend/lib/api.ts
# Should show: predictions: (instrumentKeys?, interval = "day") => ...
```

## Contact Information

If none of these solutions work:
1. Check browser console for specific error messages
2. Check backend logs for errors
3. Verify MongoDB is running and accessible
4. Verify Redis is running (if used)
5. Check network connectivity between frontend and backend

## Common Error Messages

### "No predictions available"
- Backend returned empty array
- Click "Refresh" button
- Check if historical data is loaded

### "Failed to fetch"
- Backend is not running
- CORS issue
- Network connectivity problem

### "Cannot read property of undefined"
- JavaScript error in frontend
- Check browser console for stack trace

### Loading forever (never stops)
- API call is hanging
- Check network tab for stuck requests
- Backend might be processing too long

## Success Indicators

✅ Backend returns 27-30 predictions
✅ Frontend shows prediction cards
✅ Each card has signal, confidence, and prices
✅ Search and filter work correctly
✅ Click on card opens detail modal
✅ Charts load in modal

## Performance Notes

- Initial load: 2-5 seconds
- Refresh: 2-5 seconds
- Model retrain: ~2 minutes
- Historical data load: 5-10 seconds per stock
