"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { STOCKS } from "@/lib/stocks";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const TIMEFRAMES = [
  { value: "1minute", label: "1 Min" },
  { value: "5minute", label: "5 Min" },
  { value: "15minute", label: "15 Min" },
  { value: "30minute", label: "30 Min" },
  { value: "1hour", label: "1 Hour" },
  { value: "day", label: "Daily" },
];

type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Quote = {
  last_price: number;
  net_change: number;
  volume: number;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
};

export default function IntradayPage() {
  const [selectedStock, setSelectedStock] = useState(STOCKS[0].key);
  const [selectedTimeframe, setSelectedTimeframe] = useState("5minute");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedStock, selectedTimeframe]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedStock, selectedTimeframe]);

  async function loadData() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const candleData = await api.candles(selectedStock, selectedTimeframe, {
        from_date: today,
        to_date: today,
      });
      setCandles(candleData.candles || []);

      const quoteData = await api.marketQuotes([selectedStock]);
      const stockQuote = quoteData.data?.[selectedStock];
      if (stockQuote) {
        setQuote(stockQuote);
      }
    } catch (e) {
      console.error("Failed to load intraday data:", e);
    }
    setLoading(false);
  }

  async function loadHistoricalIntraday() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.loadMarketHistory({
        instrument_key: selectedStock,
        interval: selectedTimeframe,
        to_date: today,
        from_date: today,
      });
      await loadData();
      alert("✓ Intraday data loaded successfully!");
    } catch (e: any) {
      alert("✗ Failed to load data: " + (e.message || e));
    }
    setLoading(false);
  }

  const stockName = STOCKS.find(s => s.key === selectedStock)?.name || selectedStock;
  const currentPrice = quote?.last_price || 0;
  const change = quote?.net_change || 0;
  const changePercent = currentPrice > 0 ? (change / (currentPrice - change)) * 100 : 0;
  const isPositive = change >= 0;

  const chartData = candles.map(c => ({
    time: new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    price: c.close,
    volume: c.volume,
  }));

  const dayHigh = Math.max(...candles.map(c => c.high), 0);
  const dayLow = Math.min(...candles.map(c => c.low), Infinity);
  const dayOpen = candles[0]?.open || 0;
  const totalVolume = candles.reduce((sum, c) => sum + c.volume, 0);
  const avgVolume = candles.length > 0 ? totalVolume / candles.length : 0;

  const returns = candles.slice(1).map((c, i) => 
    ((c.close - candles[i].close) / candles[i].close) * 100
  );
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  return (
    <div className="animate-fadeIn">
      <PageHeader 
        title="Intraday Trading" 
        subtitle="Real-time intraday charts with multiple timeframes for day trading" 
      />

      {/* Chart Controls */}
      <Panel className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted mb-2">Select Stock</label>
            <select
              value={selectedStock}
              onChange={(e) => setSelectedStock(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
            >
              {STOCKS.map((stock) => (
                <option key={stock.key} value={stock.key}>
                  {stock.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted mb-2">Timeframe</label>
            <div className="flex gap-2 flex-wrap">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setSelectedTimeframe(tf.value)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                    selectedTimeframe === tf.value
                      ? 'bg-accent text-black'
                      : 'bg-border text-muted hover:text-text'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={loadHistoricalIntraday}
              disabled={loading}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted hover:text-text hover:border-accent transition disabled:opacity-40"
            >
              {loading ? '⏳ Loading...' : '📥 Load Data'}
            </button>
            <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-border"
              />
              Auto-refresh (5s)
            </label>
          </div>
        </div>
      </Panel>

      {/* Price Display */}
      <Panel className={`mb-6 ${isPositive ? 'border-accent/30 bg-accent/5' : 'border-danger/30 bg-danger/5'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">{stockName}</h2>
            <p className="text-xs text-muted mt-1">{selectedStock}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">₹{currentPrice.toFixed(2)}</p>
            <p className={`text-lg font-semibold ${isPositive ? 'text-accent' : 'text-danger'}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
            </p>
          </div>
        </div>
      </Panel>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Open</p>
          <p className="text-xl font-bold">₹{dayOpen.toFixed(2)}</p>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">High</p>
          <p className="text-xl font-bold text-accent">₹{dayHigh.toFixed(2)}</p>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Low</p>
          <p className="text-xl font-bold text-danger">₹{dayLow.toFixed(2)}</p>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Volume</p>
          <p className="text-xl font-bold">{(totalVolume / 1000000).toFixed(2)}M</p>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Volatility</p>
          <p className="text-xl font-bold">{volatility.toFixed(2)}%</p>
        </Panel>
      </div>

      {/* Chart */}
      {candles.length > 0 ? (
        <Panel className="mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {stockName} - {TIMEFRAMES.find(tf => tf.value === selectedTimeframe)?.label} Chart
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" stroke="#888" style={{ fontSize: '12px' }} />
              <YAxis stroke="#888" style={{ fontSize: '12px' }} domain={['auto', 'auto']} tickFormatter={(value) => `₹${value.toFixed(0)}`} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} formatter={(value: any) => [`₹${value.toFixed(2)}`, 'Price']} />
              <Legend />
              <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={false} name="Price" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      ) : (
        <Panel>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">No Intraday Data</h3>
            <p className="text-sm text-muted mb-6">Click "Load Data" to fetch intraday candles</p>
          </div>
        </Panel>
      )}

      {/* Volume Chart */}
      {candles.length > 0 && (
        <Panel className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Volume Analysis</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" stroke="#888" style={{ fontSize: '12px' }} />
              <YAxis stroke="#888" style={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={2} dot={false} name="Volume" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* Trading Tips */}
      <Panel className="border-yellow-400/30 bg-yellow-400/5">
        <h3 className="text-lg font-semibold mb-3 text-yellow-400">💡 Intraday Trading Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted">
          <div>• Best time: 9:30 AM - 11:00 AM (high volatility)</div>
          <div>• Avoid: 12:00 PM - 1:00 PM (low liquidity)</div>
          <div>• Use stop-loss on every trade</div>
          <div>• Don't hold positions overnight</div>
          <div>• Follow the trend, don't fight it</div>
          <div>• Book profits at resistance levels</div>
        </div>
      </Panel>
    </div>
  );
}
