"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

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

  const filtered = filter === "ALL" ? predictions : predictions.filter((p) => p.signal === filter);
  const buys = predictions.filter((p) => p.signal === "BUY").length;
  const sells = predictions.filter((p) => p.signal === "SELL").length;
  const holds = predictions.filter((p) => p.signal === "HOLD").length;

  return (
    <div>
      <PageHeader title="AI Predictions" subtitle="Indicator-based signal analysis for all tracked NSE stocks. Auto-loads historical data if not yet stored." />

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
      ) : filtered.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted">
            {predictions.length === 0 ? "No predictions available. Click ↻ Refresh to load." : `No ${filter} signals right now.`}
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => <PredictionCard key={p.instrument_key} p={p} />)}
        </div>
      )}
    </div>
  );
}
