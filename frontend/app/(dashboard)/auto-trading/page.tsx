"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, Panel, StatCard } from "@/components/ui";
import { api } from "@/lib/api";

type LoopStatus = {
  running: boolean; last_cycle: string | null; last_error: string | null; cycles: number;
  active_position?: { instrument: string; entry: number; current: number; qty: number; pnl: number; pnl_pct: number } | null;
  log?: { t: string; msg: string }[];
};

type Funds = { available_margin: number; used_margin: number; payin_amount: number; notional_cash: number };

type Status = {
  enabled: boolean; paper_trading: boolean; daily_loss_limit: number;
  max_capital_allocation: number; profit_target_pct: number; stop_loss_pct: number;
  today_trades: number; today_pnl: number; loop: LoopStatus;
};

const DEFAULT: Status = {
  enabled: false, paper_trading: true, daily_loss_limit: 2000,
  max_capital_allocation: 50000, profit_target_pct: 1.0, stop_loss_pct: 0.5,
  today_trades: 0, today_pnl: 0,
  loop: { running: false, last_cycle: null, last_error: null, cycles: 0, log: [] },
};

export default function AutoTradingPage() {
  const [status, setStatus] = useState<Status>(DEFAULT);
  const [funds, setFunds] = useState<Funds | null>(null);

  // string fields — never coerce to number while user is typing
  const [capital, setCapital] = useState("50000");
  const [lossLimit, setLossLimit] = useState("2000");
  const [profitTarget, setProfitTarget] = useState("1.0");
  const [stopLoss, setStopLoss] = useState("0.5");
  const [paperTrading, setPaperTrading] = useState(true);

  const initialised = useRef(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function pollStatus() {
    try {
      const s = await api.autoTradingStatus() as any;
      setStatus(s);
      // only set form values on very first load
      if (!initialised.current) {
        initialised.current = true;
        setCapital(String(s.max_capital_allocation ?? 50000));
        setLossLimit(String(s.daily_loss_limit ?? 2000));
        setProfitTarget(String(s.profit_target_pct ?? 1.0));
        setStopLoss(String(s.stop_loss_pct ?? 0.5));
        setPaperTrading(s.paper_trading ?? true);
      }
    } catch {}
    try { setFunds(await api.accountFunds()); } catch {}
  }

  useEffect(() => {
    pollStatus();
    const t = setInterval(pollStatus, 6000);
    return () => clearInterval(t);
  }, []);

  async function toggle(enable: boolean) {
    setSaving(true); setMsg("");
    try {
      await (api.toggleAutoTrading as any)({
        enabled: enable,
        paper_trading: paperTrading,
        daily_loss_limit: parseFloat(lossLimit) || 0,
        max_capital_allocation: parseFloat(capital) || 0,
        profit_target_pct: parseFloat(profitTarget) || 1.0,
        stop_loss_pct: parseFloat(stopLoss) || 0.5,
      });
      setMsg(enable ? "Auto-trader started." : "Auto-trader stopped.");
      await pollStatus();
    } catch (e: unknown) { setMsg(String(e)); }
    setSaving(false);
  }

  const pos = status.loop?.active_position;
  const pnlTone = status.today_pnl >= 0 ? "positive" : "negative";
  const log = status.loop?.log ?? [];
  const capNum = parseFloat(capital) || 0;
  const ptNum = parseFloat(profitTarget) || 1;

  return (
    <div>
      <PageHeader title="Auto Trading" subtitle="Automatically finds the best stock for your capital, buys it, and sells at profit target or stop-loss. Repeats continuously." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 mb-6">
        <StatCard label="Status" value={status.enabled ? "ACTIVE" : "STOPPED"} tone={status.enabled ? "positive" : "negative"} />
        <StatCard label="Mode" value={paperTrading ? "Paper" : "LIVE ⚡"} tone={paperTrading ? undefined : "negative"} />
        <StatCard label="Available Balance" value={funds ? `₹${funds.available_margin.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "--"} tone={funds && funds.available_margin > 0 ? "positive" : "negative"} />
        <StatCard label="Today Trades" value={String(status.today_trades)} />
        <StatCard label="Today P&L" value={`₹${(status.today_pnl ?? 0).toFixed(2)}`} tone={pnlTone} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <h2 className="font-medium">Trading Parameters</h2>

          <Field label="Capital to Deploy (₹)" hint="Max amount used for trading">
            <input type="text" inputMode="numeric" value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full bg-transparent text-sm outline-none" />
          </Field>

          <Field label="Daily Loss Limit (₹)" hint="Auto-stops if losses exceed this">
            <input type="text" inputMode="numeric" value={lossLimit}
              onChange={(e) => setLossLimit(e.target.value)}
              className="w-full bg-transparent text-sm outline-none" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Profit Target (%)" hint="Sell when profit hits this">
              <input type="text" inputMode="decimal" value={profitTarget}
                onChange={(e) => setProfitTarget(e.target.value)}
                className="w-full bg-transparent text-sm outline-none" />
            </Field>
            <Field label="Stop Loss (%)" hint="Sell when loss hits this">
              <input type="text" inputMode="decimal" value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-transparent text-sm outline-none" />
            </Field>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Live Trading</p>
              <p className="text-xs text-muted">Unchecked = paper mode (safe to test)</p>
            </div>
            <input type="checkbox" checked={!paperTrading} onChange={(e) => setPaperTrading(!e.target.checked)} />
          </label>

          {!paperTrading && (
            <div className="rounded-xl border border-yellow-700 bg-yellow-950/30 px-4 py-3 text-xs text-yellow-400">
              ⚠ Live mode — real orders will be placed on your Upstox account.
            </div>
          )}

          {funds && (
            <div className="rounded-xl border border-border px-4 py-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Available Balance</span>
                <span className={funds.available_margin >= 0 ? "text-accent" : "text-danger"}>
                  ₹{funds.available_margin.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Used Margin</span>
                <span>₹{funds.used_margin.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              {funds.available_margin < capNum && !paperTrading && (
                <p className="text-yellow-400 pt-1">⚠ Available balance is less than your capital allocation.</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button disabled={saving || status.enabled} onClick={() => toggle(true)}
              className="flex-1 rounded-xl bg-accent px-4 py-3 font-medium text-black disabled:opacity-40">
              Start
            </button>
            <button disabled={saving || !status.enabled} onClick={() => toggle(false)}
              className="flex-1 rounded-xl border border-border px-4 py-3 font-medium disabled:opacity-40">
              Stop
            </button>
          </div>
          {msg && <p className="text-xs text-muted">{msg}</p>}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <h2 className="font-medium mb-3">Active Position</h2>
            {pos ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Stock</span><span className="font-semibold text-accent">{pos.instrument}</span></div>
                <div className="flex justify-between"><span className="text-muted">Entry</span><span>₹{pos.entry.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Current</span><span>₹{pos.current.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Qty</span><span>{pos.qty}</span></div>
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <span className="text-muted">Unrealized P&L</span>
                  <span className={`font-semibold ${pos.pnl >= 0 ? "text-accent" : "text-danger"}`}>
                    ₹{pos.pnl.toFixed(2)} ({pos.pnl_pct.toFixed(2)}%)
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-border overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pos.pnl >= 0 ? "bg-accent" : "bg-danger"}`}
                    style={{ width: `${Math.min(Math.abs(pos.pnl_pct) / ptNum * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-muted text-right">Target: {profitTarget}% | Stop: -{stopLoss}%</p>
              </div>
            ) : (
              <p className="text-sm text-muted">{status.enabled ? "Scanning for opportunity..." : "Not running."}</p>
            )}
          </Panel>

          <Panel>
            <h2 className="font-medium mb-3">Activity Log</h2>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {log.length === 0
                ? <p className="text-xs text-muted">No activity yet.</p>
                : log.map((l, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-muted shrink-0">{l.t}</span>
                    <span className={
                      l.msg.startsWith("ENTRY") ? "text-accent" :
                      l.msg.startsWith("EXIT") ? "text-yellow-400" :
                      l.msg.includes("failed") || l.msg.includes("loss") ? "text-danger" : "text-text"
                    }>{l.msg}</span>
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3 space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xs text-muted">{hint}</p>
      {children}
    </div>
  );
}
