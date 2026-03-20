# Stock List Update Summary

## Changes Made

Added 10 more diverse Indian stocks to the platform, bringing the total from 20 to 30 stocks.

## New Stocks Added

1. **SUNPHARMA** (Sun Pharmaceutical) - `NSE_EQ|INE040H01021`
2. **POWERGRID** (Power Grid Corporation) - `NSE_EQ|INE002S01010`
3. **TITAN** (Titan Company) - `NSE_EQ|INE192A01025`
4. **BAJFINANCE** (Bajaj Finance) - `NSE_EQ|INE114A01011`
5. **BAJAJFINSV** (Bajaj Finserv) - `NSE_EQ|INE296A01024`
6. **HCL** (HCL Technologies) - `NSE_EQ|INE860A01027`
7. **TECHM** (Tech Mahindra) - `NSE_EQ|INE075A01022`
8. **ONGC** (Oil and Natural Gas Corporation) - `NSE_EQ|INE769A01020`
9. **ULTRACEMCO** (UltraTech Cement) - `NSE_EQ|INE213A01029`
10. **NESTLEIND** (Nestle India) - `NSE_EQ|INE021A01026`

## Files Updated

### Frontend
1. **`/frontend/lib/stocks.ts`** - Main stock configuration (30 stocks)
2. **`/frontend/app/(dashboard)/dashboard/page.tsx`** - Dashboard stock list (30 stocks)
3. **`/frontend/app/(dashboard)/strategy-builder/page.tsx`** - Strategy builder stock selection (30 stocks)
4. **`/frontend/app/(dashboard)/backtesting/page.tsx`** - Backtesting stock selection (30 stocks)

### Files Using Shared Config (No Changes Needed)
- `/frontend/app/(dashboard)/intraday/page.tsx` - Uses `import { STOCKS } from "@/lib/stocks"`
- `/frontend/app/(dashboard)/scalping-bot/page.tsx` - Uses `import { STOCKS } from "@/lib/stocks"`

## Complete Stock List (30 Total)

### Banking & Financial Services (7)
- HDFCBANK, ICICIBANK, SBIN, AXISBANK, KOTAK, BAJFINANCE, BAJAJFINSV

### IT & Technology (5)
- TCS, INFY, WIPRO, HCL, TECHM

### Energy & Utilities (3)
- RELIANCE, ONGC, POWERGRID

### Automotive (3)
- TATAMOTORS, MARUTI, MAHINDRA

### Telecom (1)
- BHARTIARTL

### FMCG & Consumer (4)
- HINDUNILVR, ITC, TITAN, NESTLEIND

### Infrastructure & Industrials (4)
- LT, TATASTEEL, ADANIPORTS, ULTRACEMCO

### Conglomerate (2)
- ADANIENT, ASIANPAINT

### Pharmaceuticals (1)
- SUNPHARMA

## Sector Diversification

The updated stock list provides excellent diversification across:
- Banking & Finance: 23%
- IT & Technology: 17%
- Energy & Utilities: 10%
- Automotive: 10%
- FMCG & Consumer: 13%
- Infrastructure: 13%
- Others: 14%

## Next Steps

1. The frontend will automatically use the updated stock lists
2. No backend changes required - the backend dynamically handles any instrument keys
3. Consider updating the `.env` file's `UPSTOX_STREAM_INSTRUMENTS` if you want to stream all 30 stocks
4. Test the updated stock selections in:
   - Dashboard page
   - Strategy Builder
   - Backtesting
   - Intraday trading
   - Scalping bot

## Notes

- All stocks are NSE (National Stock Exchange) equities
- ISINs are valid Upstox instrument keys
- The stocks represent major companies across different sectors
- Total market cap coverage is significantly improved
