// Shared stock configuration for the entire platform

export const STOCKS = [
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
  // New additions
  { key: "NSE_EQ|INE155A01022", name: "TATAMOTORS" },
  { key: "NSE_EQ|INE192A01025", name: "TATAPOWER" },
  { key: "NSE_EQ|INE081A01020", name: "TATACHEM" },
  { key: "NSE_EQ|INE245A01021", name: "TATACOMM" },
  { key: "NSE_EQ|INE769A01020", name: "TATACOFFEE" },
  { key: "NSE_EQ|INE669E01016", name: "TATAMTRDVR" },
  { key: "NSE_EQ|INE123W01016", name: "TATACONSUMER" },
  { key: "NSE_EQ|INE685A01028", name: "TATAELXSI" },
  { key: "NSE_EQ|INE470A01017", name: "TATAINVEST" },
  { key: "NSE_EQ|INE721A01013", name: "TATASTEEL" },
];

export const STOCK_LABELS: Record<string, string> = STOCKS.reduce((acc, stock) => {
  acc[stock.key] = stock.name;
  return acc;
}, {} as Record<string, string>);

export const WATCHLIST = STOCKS.map(s => s.key);
