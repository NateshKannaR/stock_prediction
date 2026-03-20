"use client";

import { useState } from "react";

import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

export default function BacktestingPage() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function runBacktest() {
    const response = await api.runBacktest({
      instrument_key: "NSE_EQ|INE009A01021",
      interval: "day",
      starting_capital: 500000,
      strategy_id: 1,
    });
    setResult(response);
  }

  return (
    <div>
      <PageHeader title="Backtesting" subtitle="Run historical simulations against stored real candles and evaluate risk-adjusted performance." />
      <Panel className="space-y-4">
        <button onClick={runBacktest} className="rounded-xl bg-accent px-4 py-3 font-medium text-black">
          Run Backtest
        </button>
        {result ? <pre className="overflow-auto rounded-xl border border-border p-4 text-xs text-muted">{JSON.stringify(result, null, 2)}</pre> : <p className="text-sm text-muted">Load historical candles and create a strategy before running a backtest.</p>}
      </Panel>
    </div>
  );
}

