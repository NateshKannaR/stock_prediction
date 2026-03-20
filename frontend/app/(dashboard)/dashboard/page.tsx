"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/ui";
import { api, type MarketQuoteRow } from "@/lib/api";

const NSE_KEY = "NSE_INDEX|Nifty 50";
const BSE_KEY = "BSE_INDEX|SENSEX";

const STOCKS = [
  { label: "RELIANCE",   key: "NSE_EQ|INE002A01018" },
  { label: "TCS",        key: "NSE_EQ|INE467B01029" },
  { label: "HDFCBANK",   key: "NSE_EQ|INE040A01034" },
  { label: "INFY",       key: "NSE_EQ|INE009A01021" },
  { label: "ICICIBANK",  key: "NSE_EQ|INE090A01021" },
  { label: "SBIN",       key: "NSE_EQ|INE062A01020" },
  { label: "BHARTIARTL", key: "NSE_EQ|INE397D01024" },
  { label: "ITC",        key: "NSE_EQ|INE154A01025" },
  { label: "LT",         key: "NSE_EQ|INE018A01030" },
  { label: "HINDUNILVR", key: "NSE_EQ|INE030A01027" },
  { label: "TATAMOTORS", key: "NSE_EQ|INE155A01022" },
  { label: "TATASTEEL",  key: "NSE_EQ|INE721A01013" },
  { label: "AXISBANK",   key: "NSE_EQ|INE019A01038" },
  { label: "KOTAK",      key: "NSE_EQ|INE238A01034" },
  { label: "ASIANPAINT", key: "NSE_EQ|INE120A01034" },
  { label: "ADANIENT",   key: "NSE_EQ|INE752E01010" },
  { label: "ADANIPORTS", key: "NSE_EQ|INE742F01042" },
  { label: "MARUTI",     key: "NSE_EQ|INE066A01021" },
  { label: "MAHINDRA",   key: "NSE_EQ|INE101D01020" },
  { label: "WIPRO",      key: "NSE_EQ|INE239A01016" },
  { label: "SUNPHARMA",  key: "NSE_EQ|INE040H01021" },
  { label: "POWERGRID",  key: "NSE_EQ|INE002S01010" },
  { label: "TITAN",      key: "NSE_EQ|INE192A01025" },
  { label: "BAJFINANCE", key: "NSE_EQ|INE114A01011" },
  { label: "BAJAJFINSV", key: "NSE_EQ|INE296A01024" },
  { label: "HCL",        key: "NSE_EQ|INE860A01027" },
  { label: "TECHM",      key: "NSE_EQ|INE075A01022" },
  { label: "ONGC",       key: "NSE_EQ|INE769A01020" },
  { label: "ULTRACEMCO", key: "NSE_EQ|INE213A01029" },
  { label: "NESTLEIND",  key: "NSE_EQ|INE021A01026" },
];

type Candle = { timestamp: string; close: number };
type Quote = MarketQuoteRow;

function p(v?: number, dec = 2) {
  return v == null ? "--" : v.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function chg(v?: number) {
  if (v == null) return "--";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}
function pct(change?: number, close?: number) {
  if (change == null || !close) return "";
  return ` (${((change / close) * 100).toFixed(2)}%)`;
}
function tone(v?: number) {
  return (v ?? 0) >= 0 ? "text-accent" : "text-danger";
}

function IndexChart({ data, color }: { data: Candle[]; color: string }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">Loading chart...</p>;
  return (
    <div className="h-48 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`fill-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1d2844" strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" tick={{ fill: "#8692b3", fontSize: 11 }} minTickGap={40} />
          <YAxis tick={{ fill: "#8692b3", fontSize: 11 }} width={75} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "#0e1325", border: "1px solid #1d2844", fontSize: 12 }} />
          <Area type="monotone" dataKey="close" stroke={color} fill={`url(#fill-${color})`} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

async function loadIndexCandles(instrumentKey: string): Promise<Candle[]> {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  try {
    let res = await api.candles(instrumentKey, "day", { from_date: from, to_date: today });
    if (res.candles.length === 0) {
      await api.loadMarketHistory({ instrument_key: instrumentKey, interval: "day", from_date: from, to_date: today });
      res = await api.candles(instrumentKey, "day", { from_date: from, to_date: today });
    }
    return res.candles.map((c) => ({ timestamp: c.timestamp.slice(0, 10), close: c.close }));
  } catch { return []; }
}

export default function DashboardPage() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [nseChart, setNseChart] = useState<Candle[]>([]);
  const [bseChart, setBseChart] = useState<Candle[]>([]);
  const [updated, setUpdated] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadQuotes() {
      try {
        const keys = [NSE_KEY, BSE_KEY, ...STOCKS.map((s) => s.key)];
        const res = await api.marketQuotes(keys);
        setQuotes(res.data ?? {});
        setUpdated(new Date().toLocaleTimeString("en-IN"));
      } catch {}
    }
    loadQuotes();
    const t = setInterval(loadQuotes, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadIndexCandles(NSE_KEY).then(setNseChart);
    loadIndexCandles(BSE_KEY).then(setBseChart);
  }, []);

  function getQuote(key: string): Quote | undefined {
    return quotes[key] ?? Object.values(quotes).find((q: any) => q.instrument_token === key);
  }

  const nse = getQuote(NSE_KEY);
  const bse = getQuote(BSE_KEY);

  const filteredStocks = STOCKS.filter(stock => 
    stock.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Index row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* NSE */}
        <Panel>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">NSE · Nifty 50</p>
              <p className="mt-1 text-4xl font-semibold">{p(nse?.last_price)}</p>
              <p className={`mt-1 text-base font-medium ${tone(nse?.net_change)}`}>
                {chg(nse?.net_change)}{pct(nse?.net_change, nse?.ohlc?.close)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-right">
              <span className="text-muted">Open</span><span>{p(nse?.ohlc?.open)}</span>
              <span className="text-muted">High</span><span className="text-accent">{p(nse?.ohlc?.high)}</span>
              <span className="text-muted">Low</span><span className="text-danger">{p(nse?.ohlc?.low)}</span>
              <span className="text-muted">Prev</span><span>{p(nse?.ohlc?.close)}</span>
            </div>
          </div>
          <IndexChart data={nseChart} color="#29d391" />
        </Panel>

        {/* BSE */}
        <Panel>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">BSE · Sensex</p>
              <p className="mt-1 text-4xl font-semibold">{p(bse?.last_price)}</p>
              <p className={`mt-1 text-base font-medium ${tone(bse?.net_change)}`}>
                {chg(bse?.net_change)}{pct(bse?.net_change, bse?.ohlc?.close)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-right">
              <span className="text-muted">Open</span><span>{p(bse?.ohlc?.open)}</span>
              <span className="text-muted">High</span><span className="text-accent">{p(bse?.ohlc?.high)}</span>
              <span className="text-muted">Low</span><span className="text-danger">{p(bse?.ohlc?.low)}</span>
              <span className="text-muted">Prev</span><span>{p(bse?.ohlc?.close)}</span>
            </div>
          </div>
          <IndexChart data={bseChart} color="#3b82f6" />
        </Panel>
      </div>

      {/* Stocks grid */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-4">
          <p className="text-xs uppercase tracking-widest text-muted">NSE Stocks</p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl border border-border bg-panel px-4 py-2 pl-10 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none w-64"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xs text-muted whitespace-nowrap">Updated {updated || "--"}</p>
          </div>
        </div>
        {filteredStocks.length === 0 ? (
          <Panel className="p-8 text-center">
            <p className="text-muted">No stocks found matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-3 text-sm text-accent hover:underline"
            >
              Clear search
            </button>
          </Panel>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {filteredStocks.map((s) => {
            const q = getQuote(s.key);
            const pos = (q?.net_change ?? 0) >= 0;
            return (
              <Panel key={s.key} className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</p>
                <p className="mt-2 text-xl font-semibold">₹{p(q?.last_price)}</p>
                <p className={`mt-1 text-sm ${pos ? "text-accent" : "text-danger"}`}>
                  {chg(q?.net_change)}{pct(q?.net_change, q?.ohlc?.close)}
                </p>
                <div className="mt-2 flex justify-between text-xs text-muted">
                  <span>H: ₹{p(q?.ohlc?.high)}</span>
                  <span>L: ₹{p(q?.ohlc?.low)}</span>
                </div>
              </Panel>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
