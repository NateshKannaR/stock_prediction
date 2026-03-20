// Shared stock configuration for the entire platform

export const STOCKS = [
  // Original stocks
  { key: "NSE_EQ|INE002A01018", name: "RELIANCE" },
  { key: "NSE_EQ|INE467B01029", name: "TCS" },
  { key: "NSE_EQ|INE040A01034", name: "HDFCBANK" },
  { key: "NSE_EQ|INE009A01021", name: "INFY" },
  { key: "NSE_EQ|INE090A01021", name: "ICICIBANK" },
  { key: "NSE_EQ|INE062A01020", name: "SBIN" },
  { key: "NSE_EQ|INE397D01024", name: "BHARTIARTL" },
  { key: "NSE_EQ|INE154A01025", name: "ITC" },
  { key: "NSE_EQ|INE018A01030", name: "LT" },
  { key: "NSE_EQ|INE030A01027", name: "HINDUNILVR" },
  // Tata Group (2 stocks)
  { key: "NSE_EQ|INE155A01022", name: "TATAMOTORS" },
  { key: "NSE_EQ|INE721A01013", name: "TATASTEEL" },
  // Additional 8 diverse stocks
  { key: "NSE_EQ|INE019A01038", name: "AXISBANK" },
  { key: "NSE_EQ|INE238A01034", name: "KOTAK" },
  { key: "NSE_EQ|INE120A01034", name: "ASIANPAINT" },
  { key: "NSE_EQ|INE752E01010", name: "ADANIENT" },
  { key: "NSE_EQ|INE742F01042", name: "ADANIPORTS" },
  { key: "NSE_EQ|INE066A01021", name: "MARUTI" },
  { key: "NSE_EQ|INE101D01020", name: "MAHINDRA" },
  { key: "NSE_EQ|INE239A01016", name: "WIPRO" },
  // Additional 10 stocks
  { key: "NSE_EQ|INE040H01021", name: "SUNPHARMA" },
  { key: "NSE_EQ|INE002S01010", name: "POWERGRID" },
  { key: "NSE_EQ|INE192A01025", name: "TITAN" },
  { key: "NSE_EQ|INE114A01011", name: "BAJFINANCE" },
  { key: "NSE_EQ|INE296A01024", name: "BAJAJFINSV" },
  { key: "NSE_EQ|INE860A01027", name: "HCL" },
  { key: "NSE_EQ|INE075A01022", name: "TECHM" },
  { key: "NSE_EQ|INE769A01020", name: "ONGC" },
  { key: "NSE_EQ|INE213A01029", name: "ULTRACEMCO" },
  { key: "NSE_EQ|INE021A01026", name: "NESTLEIND" },
];

export const STOCK_LABELS: Record<string, string> = STOCKS.reduce((acc, stock) => {
  acc[stock.key] = stock.name;
  return acc;
}, {} as Record<string, string>);

export const WATCHLIST = STOCKS.map(s => s.key);
