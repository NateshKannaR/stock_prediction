"use client";

import { useState } from "react";

import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

export default function StrategyBuilderPage() {
  const [result, setResult] = useState("");

  async function createStrategy() {
    const response = await api.createStrategy({
      name: "RSI MACD Momentum",
      instruments: ["NSE_EQ|INE009A01021"],
      indicators: { rsi: 14, macd: [12, 26, 9], moving_average: [20, 50], bollinger: [20, 2] },
      entry_rules: { rsi_below: 35, macd_cross: "bullish" },
      exit_rules: { rsi_above: 65, stop_loss_pct: 1.5, trailing_stop_pct: 1.0, take_profit_pct: 3.0 },
      risk_params: { capital_allocation: 100000, max_positions: 3 },
    });
    setResult(JSON.stringify(response));
  }

  return (
    <div>
      <PageHeader title="Strategy Builder" subtitle="Visual strategy composition backed by persisted JSON rules, indicator sets, and risk parameters." />
      <Panel className="space-y-4">
        <p className="text-sm text-muted">This starter builder posts a real strategy definition to the backend. Extend it with drag-and-drop rule blocks as the next UI iteration.</p>
        <button onClick={createStrategy} className="rounded-xl bg-accent px-4 py-3 font-medium text-black">
          Create Momentum Strategy
        </button>
        {result ? <pre className="rounded-xl border border-border p-4 text-xs text-muted">{result}</pre> : null}
      </Panel>
    </div>
  );
}

