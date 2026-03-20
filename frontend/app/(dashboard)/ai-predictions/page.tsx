"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";

const LABELS: Record<string, string> = {
  "NSE_EQ|INE002A01018": "RELIANCE",
  "NSE_EQ|INE467B01029": "TCS",
  "NSE_EQ|INE040A01034": "HDFCBANK",
  "NSE_EQ|INE009A01021": "INFY",
  "NSE_EQ|INE090A01021": "ICICIBANK",
  "NSE_EQ|INE062A01020": "SBIN",
  "NSE_EQ|INE397D01024": "BHARTIARTL",
  "NSE_EQ|INE154A01025": "ITC",
  "NSE_EQ|INE018A01030": "LT",
  "NSE_EQ|INE030A01027": "HINDUNILVR",
  "NSE_EQ|INE155A01022": "TATAMOTORS",
  "NSE_EQ|INE721A01013": "TATASTEEL",
  "NSE_EQ|INE019A01038": "AXISBANK",
  "NSE_EQ|INE238A01034": "KOTAK",
  "NSE_EQ|INE120A01034": "ASIANPAINT",
  "NSE_EQ|INE752E01010": "ADANIENT",
  "NSE_EQ|INE742F01042": "ADANIPORTS",
  "NSE_EQ|INE066A01021": "MARUTI",
  "NSE_EQ|INE101D01020": "MAHINDRA",
  "NSE_EQ|INE239A01016": "WIPRO",
  "NSE_EQ|INE040H01021": "SUNPHARMA",
  "NSE_EQ|INE002S01010": "POWERGRID",
  "NSE_EQ|INE192A01025": "TITAN",
  "NSE_EQ|INE114A01011": "BAJFINANCE",
  "NSE_EQ|INE296A01024": "BAJAJFINSV",
  "NSE_EQ|INE860A01027": "HCL",
  "NSE_EQ|INE075A01022": "TECHM",
  "NSE_EQ|INE769A01020": "ONGC",
  "NSE_EQ|INE213A01029": "ULTRACEMCO",
  "NSE_EQ|INE021A01026": "NESTLEIND",
};

type Prediction = {
  instrument_key: string; signal: "BUY" | "SELL" | "HOLD";
  confidence: number; last_close: number; change: number; change_pct: number;
  target_price: number; stop_loss: number; support: number; resistance: number;
  source: string; features: Record<string, number | string>; generated_at: string;
};

function SignalBadge({ signal }: { signal: string }) {
  const cls = signal === "BUY" ? "bg-accent/20 text-accent border-accent/40"
    : signal === "SELL" ? "bg-danger/20 text-danger border-danger/40"
    : "bg-border text-muted border-border";
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold tracking-widest ${cls}`}>{signal}</span>;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-accent" : pct >= 50 ? "bg-yellow-400" : "bg-danger";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">Confidence</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function IndicatorRow({ label, value, good }: { label: string; value: string; good?: boolean | null }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xs font-medium ${good === true ? "text-accent" : good === false ? "text-danger" : "text-text"}`}>{value}</span>
    </div>
  );
}

function PredictionCard({ p }: { p: Prediction }) {
  const [expanded, setExpanded] = useState(false);
  const f = p.features as Record<string, any>;
  const changePos = p.change_pct >= 0;

  return (
    <Panel className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">{p.instrument_key}</p>
          <p className="mt-1 text-2xl font-bold">{LABELS[p.instrument_key] ?? p.instrument_key}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-semibold">₹{p.last_close.toFixed(2)}</span>
            <span className={`text-sm ${changePos ? "text-accent" : "text-danger"}`}>
              {changePos ? "+" : ""}{p.change.toFixed(2)} ({changePos ? "+" : ""}{p.change_pct.toFixed(2)}%)
            </span>
          </div>
        </div>
        <SignalBadge signal={p.signal} />
      </div>

      {/* Confidence */}
      <ConfidenceBar value={p.confidence} />

      {/* Target / Stop / Support / Resistance */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2">
          <p className="text-xs text-muted">Target</p>
          <p className="text-sm font-semibold text-accent">₹{p.target_price.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2">
          <p className="text-xs text-muted">Stop Loss</p>
          <p className="text-sm font-semibold text-danger">₹{p.stop_loss.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border px-3 py-2">
          <p className="text-xs text-muted">Support</p>
          <p className="text-sm font-medium">₹{p.support.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border px-3 py-2">
          <p className="text-xs text-muted">Resistance</p>
          <p className="text-sm font-medium">₹{p.resistance.toFixed(2)}</p>
        </div>
      </div>

      {/* Key indicators summary */}
      <div className="rounded-xl border border-border px-3 py-2 space-y-0">
        <IndicatorRow label="RSI (14)" value={String(f.rsi_14)}
          good={f.rsi_14 < 40 ? true : f.rsi_14 > 65 ? false : null} />
        <IndicatorRow label="MACD Crossover" value={String(f.macd_crossover)}
          good={f.macd_crossover === "bullish" ? true : f.macd_crossover === "bearish" ? false : null} />
        <IndicatorRow label="Price vs SMA20" value={`${f.price_vs_sma > 0 ? "+" : ""}${f.price_vs_sma}%`}
          good={f.price_vs_sma > 0 ? true : f.price_vs_sma < 0 ? false : null} />
        <IndicatorRow label="BB Position" value={`${f.bb_position_pct}%`}
          good={f.bb_position_pct < 25 ? true : f.bb_position_pct > 75 ? false : null} />
        <IndicatorRow label="Volume vs Avg" value={`${f.volume_vs_avg}x`}
          good={f.volume_vs_avg > 1.2 ? true : null} />
      </div>

      {/* Expand for full indicators */}
      <button onClick={() => setExpanded(!expanded)}
        className="text-xs text-muted hover:text-text transition text-left">
        {expanded ? "▲ Hide" : "▼ Show"} full indicator breakdown
      </button>

      {expanded && (
        <div className="rounded-xl border border-border px-3 py-2 space-y-0">
          <IndicatorRow label="MACD" value={String(f.macd)} />
          <IndicatorRow label="MACD Signal" value={String(f.macd_signal)} />
          <IndicatorRow label="SMA 20" value={`₹${f.sma_20}`} />
          <IndicatorRow label="EMA 20" value={`₹${f.ema_20}`} />
          <IndicatorRow label="BB High" value={`₹${f.bb_high}`} />
          <IndicatorRow label="BB Low" value={`₹${f.bb_low}`} />
          <IndicatorRow label="Volatility (20d)" value={`${f.volatility_20}%`} />
          <IndicatorRow label="Daily Return" value={`${f.returns_pct}%`}
            good={f.returns_pct > 0 ? true : f.returns_pct < 0 ? false : null} />
          <IndicatorRow label="Buy Score" value={String(f.buy_score)} good={true} />
          <IndicatorRow label="Sell Score" value={String(f.sell_score)} good={false} />
          <IndicatorRow label="Source" value={p.source} />
        </div>
      )}

      <p className="text-xs text-muted">
        Updated {new Date(p.generated_at).toLocaleTimeString("en-IN")} · {p.source}
      </p>
    </Panel>
  );
}

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<any>(null);
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL" | "HOLD">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stockNews, setStockNews] = useState<any[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [sentiment, setSentiment] = useState<any>(null);

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

  async function trainModel() {
    setTraining(true); setTrainResult(null);
    try {
      const data = await api.trainModel();
      setTrainResult(data);
      await load();
    } catch (e) { setTrainResult({ error: String(e) }); }
    setTraining(false);
  }

  useEffect(() => { load(); }, []);

  async function loadStockNews(instrumentKey: string) {
    setLoadingNews(true);
    try {
      // Fetch sentiment with news (this already uses targeted queries)
      const sentimentRes = await fetch(`http://localhost:8000/api/v1/sentiment/${encodeURIComponent(instrumentKey)}?hours=48`);
      const sentimentData = await sentimentRes.json();
      setSentiment(sentimentData);
      
      // Use dedicated stock-specific news endpoint
      const newsRes = await fetch(`http://localhost:8000/api/v1/news/stock/${encodeURIComponent(instrumentKey)}?hours=72`);
      const newsData = await newsRes.json();
      
      setStockNews(newsData.articles || []);
    } catch (e) {
      console.error("Failed to load news:", e);
      setStockNews([]);
      setSentiment(null);
    }
    setLoadingNews(false);
  }

  async function loadHistoricalData(instrumentKey: string) {
    setLoadingHistory(true);
    try {
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(`http://localhost:8000/api/v1/market/history/${instrumentKey}?interval=day&from_date=${fromDate}&to_date=${toDate}`);
      const data = await res.json();
      
      const chartData = data.candles.map((c: any) => ({
        date: new Date(c.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        price: c.close,
        high: c.high,
        low: c.low,
      }));
      
      // Add future predictions (simple projection based on trend)
      const prediction = predictions.find(p => p.instrument_key === instrumentKey);
      if (prediction && chartData.length > 0) {
        const lastPrice = chartData[chartData.length - 1].price;
        const targetPrice = prediction.target_price;
        const days = 30;
        const dailyChange = (targetPrice - lastPrice) / days;
        
        for (let i = 1; i <= days; i++) {
          const futureDate = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
          chartData.push({
            date: futureDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            price: null,
            predicted: lastPrice + (dailyChange * i),
            high: null,
            low: null,
          });
        }
      }
      
      setHistoricalData(chartData);
    } catch (e) {
      console.error("Failed to load history:", e);
    }
    setLoadingHistory(false);
  }

  function handleStockSelect(instrumentKey: string) {
    setSelectedStock(instrumentKey);
    loadHistoricalData(instrumentKey);
    loadStockNews(instrumentKey);
  }

  const filtered = filter === "ALL" ? predictions : predictions.filter((p) => p.signal === filter);
  const searchFiltered = searchQuery
    ? filtered.filter(p => 
        LABELS[p.instrument_key]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.instrument_key.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filtered;
  const buys = predictions.filter((p) => p.signal === "BUY").length;
  const sells = predictions.filter((p) => p.signal === "SELL").length;
  const holds = predictions.filter((p) => p.signal === "HOLD").length;
  
  const selectedPrediction = selectedStock ? predictions.find(p => p.instrument_key === selectedStock) : null;

  return (
    <div>
      <PageHeader title="AI Predictions" subtitle="Indicator-based signal analysis for all tracked NSE stocks. Auto-loads historical data if not yet stored." />

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="🔍 Search stock by name or symbol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {/* Action bar — always visible */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs text-accent">
          <span className="h-2 w-2 rounded-full bg-accent inline-block" />
          LSTM model loaded
        </div>
        <button onClick={load} disabled={loading}
          className="rounded-full border border-border px-4 py-1.5 text-sm text-muted hover:text-text transition disabled:opacity-40">
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
        <button onClick={trainModel} disabled={training}
          className="rounded-full border border-border px-4 py-1.5 text-sm text-muted hover:text-text transition disabled:opacity-40">
          {training ? "⏳ Retraining... (~2 min)" : "↺ Retrain Model"}
        </button>
      </div>

      {trainResult && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-xs ${trainResult.error ? "border-danger/40 bg-danger/5 text-danger" : "border-accent/40 bg-accent/5 text-accent"}`}>
          {trainResult.error ? String(trainResult.error) : `✓ Model trained — ${trainResult.epochs_trained} epochs, val accuracy: ${trainResult.best_val_acc}%, samples: ${trainResult.samples}. Predictions now use LSTM.`}
        </div>
      )}

      {/* Filter bar — only when predictions loaded */}
      {predictions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {(["ALL", "BUY", "SELL", "HOLD"] as const).map((f) => {
            const count = f === "ALL" ? predictions.length : f === "BUY" ? buys : f === "SELL" ? sells : holds;
            const active = filter === f;
            const color = f === "BUY" ? "border-accent text-accent" : f === "SELL" ? "border-danger text-danger" : "border-border text-muted";
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${active ? color + " bg-white/5" : "border-border text-muted hover:text-text"}`}>
                {f} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Panel key={i} className="h-64 animate-pulse bg-panel/50" />
          ))}
        </div>
      ) : searchFiltered.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted">
            {predictions.length === 0 ? "No predictions available. Click ↻ Refresh to load." : `No ${filter} signals matching "${searchQuery}".`}
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {searchFiltered.map((p) => (
            <div key={p.instrument_key} onClick={() => handleStockSelect(p.instrument_key)} className="cursor-pointer">
              <PredictionCard p={p} />
            </div>
          ))}
        </div>
      )}

      {/* Stock Detail Modal with Chart */}
      {selectedStock && selectedPrediction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedStock(null)}>
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-panel p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold">{LABELS[selectedStock] ?? selectedStock}</h2>
                <p className="text-sm text-muted mt-1">{selectedStock}</p>
              </div>
              <button onClick={() => setSelectedStock(null)} className="text-2xl text-muted hover:text-text">×</button>
            </div>

            {/* Price and Signal Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted mb-1">Current Price</p>
                <p className="text-2xl font-bold">₹{selectedPrediction.last_close.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <p className="text-xs text-muted mb-1">Target Price</p>
                <p className="text-2xl font-bold text-accent">₹{selectedPrediction.target_price.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
                <p className="text-xs text-muted mb-1">Stop Loss</p>
                <p className="text-2xl font-bold text-danger">₹{selectedPrediction.stop_loss.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted mb-1">Signal</p>
                <SignalBadge signal={selectedPrediction.signal} />
              </div>
            </div>

            {/* Historical + Future Prediction Chart */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Price History & 30-Day Prediction</h3>
              {loadingHistory ? (
                <div className="h-96 flex items-center justify-center border border-border rounded-xl">
                  <p className="text-muted">Loading chart...</p>
                </div>
              ) : historicalData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={historicalData}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#888" style={{ fontSize: '12px' }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#888' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="price" stroke="#10b981" fill="url(#colorPrice)" name="Actual Price" strokeWidth={2} />
                    <Area type="monotone" dataKey="predicted" stroke="#3b82f6" fill="url(#colorPredicted)" name="Predicted Price" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-96 flex items-center justify-center border border-border rounded-xl">
                  <p className="text-muted">No historical data available</p>
                </div>
              )}
            </div>

            {/* Future Prediction Summary */}
            <div className="rounded-xl border border-border p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3">30-Day Forecast Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted">Expected Price (30 days)</p>
                  <p className="text-xl font-bold text-accent">₹{selectedPrediction.target_price.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Potential Gain/Loss</p>
                  <p className={`text-xl font-bold ${selectedPrediction.target_price > selectedPrediction.last_close ? 'text-accent' : 'text-danger'}`}>
                    {((selectedPrediction.target_price - selectedPrediction.last_close) / selectedPrediction.last_close * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Confidence Level</p>
                  <p className="text-xl font-bold">{Math.round(selectedPrediction.confidence * 100)}%</p>
                </div>
              </div>
            </div>

            {/* News Sentiment Section */}
            {sentiment && (
              <div className="rounded-xl border border-border p-4 mb-6">
                <h3 className="text-lg font-semibold mb-3">News Sentiment Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted mb-1">Overall Sentiment</p>
                    <p className={`text-xl font-bold ${
                      sentiment.sentiment_label === 'positive' ? 'text-accent' :
                      sentiment.sentiment_label === 'negative' ? 'text-danger' : 'text-muted'
                    }`}>
                      {sentiment.sentiment_label.toUpperCase()}
                    </p>
                    <p className="text-xs text-muted mt-1">Score: {sentiment.sentiment_score.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <p className="text-xs text-muted mb-1">Positive News</p>
                    <p className="text-2xl font-bold text-accent">{sentiment.positive_count}</p>
                  </div>
                  <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                    <p className="text-xs text-muted mb-1">Negative News</p>
                    <p className="text-2xl font-bold text-danger">{sentiment.negative_count}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted mb-1">Neutral News</p>
                    <p className="text-2xl font-bold">{sentiment.neutral_count}</p>
                  </div>
                </div>
                
                {/* Top Headlines from Sentiment */}
                {sentiment.top_headlines && sentiment.top_headlines.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Recent Headlines (Last 48 hours)</h4>
                    <div className="space-y-2">
                      {sentiment.top_headlines.map((headline: any, idx: number) => (
                        <div key={idx} className="rounded-lg border border-border p-3 hover:bg-white/5 transition">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium flex-1">{headline.title}</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              headline.sentiment > 0.1 ? 'bg-accent/20 text-accent' :
                              headline.sentiment < -0.1 ? 'bg-danger/20 text-danger' :
                              'bg-border text-muted'
                            }`}>
                              {headline.sentiment > 0 ? '+' : ''}{headline.sentiment.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                            <span>{headline.source}</span>
                            <span>•</span>
                            <span>{new Date(headline.published_at).toLocaleDateString('en-IN')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Latest News Section */}
            <div className="rounded-xl border border-border p-4">
              <h3 className="text-lg font-semibold mb-3">Latest News & Updates</h3>
              {loadingNews ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted">Loading news...</p>
                </div>
              ) : stockNews.length > 0 ? (
                <div className="space-y-3">
                  {stockNews.slice(0, 10).map((article: any, idx: number) => (
                    <a
                      key={idx}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-border p-4 hover:bg-white/5 hover:border-accent/40 transition"
                    >
                      <div className="flex gap-4">
                        {article.image && (
                          <img
                            src={article.image}
                            alt=""
                            className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1 line-clamp-2">{article.title}</h4>
                          {article.description && (
                            <p className="text-xs text-muted line-clamp-2 mb-2">{article.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <span>{article.source}</span>
                            <span>•</span>
                            <span>{new Date(article.published_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted">No recent news available for this stock</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
