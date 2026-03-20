const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function apiFetchSafe<T>(request: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await request();
  } catch {
    return fallback;
  }
}

export type MarketQuoteRow = {
  instrument_token?: string;
  symbol?: string;
  last_price?: number;
  net_change?: number;
  volume?: number;
  timestamp?: string;
  ohlc?: {
    open?: number;
    high?: number;
    low?: number;
    close?: number;
  };
};

export const api = {
  news: (q?: string) => apiFetch<{ articles: Array<{ title: string; description: string; url: string; source: string; published_at: string; image: string }> }>(`/news${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  accountFunds: () => apiFetch<{ available_margin: number; used_margin: number; payin_amount: number; notional_cash: number }>("/account/funds"),
  bootstrapAdmin: () => apiFetch<{ id: number; email: string }>("/auth/bootstrap-admin", { method: "POST" }),
  upstoxStatus: () => apiFetch<{ connected: boolean; updated_at: string | null }>("/settings/upstox/status"),
  portfolioSummary: () => apiFetch<{ total_capital: number; realized_pnl: number; open_positions: number; trade_count: number }>("/portfolio/summary"),
  positions: () => apiFetch<Array<{ instrument_key: string; net_quantity: number; average_price: number; last_trade_price: number }>>("/portfolio/positions"),
  tradeHistory: () => apiFetch<Array<{ id: number; strategy_name: string; instrument_key: string; side: string; quantity: number; price: number; status: string; created_at: string }>>("/trades/history"),
  strategies: () => apiFetch<Array<Record<string, unknown>>>("/strategies"),
  autoTradingStatus: () => apiFetch<{ enabled: boolean; paper_trading: boolean; daily_loss_limit: number; max_capital_allocation: number; today_trades: number; today_pnl: number; loop: { running: boolean; last_cycle: string | null; last_error: string | null; cycles: number } }>("/trading/auto-trading/status"),
  marketQuotes: (instrumentKeys: string[]) =>
    apiFetch<{ status?: string; data?: Record<string, MarketQuoteRow> }>("/market/quotes", {
      method: "POST",
      body: JSON.stringify({ instrument_keys: instrumentKeys }),
    }),
  loadMarketHistory: (payload: { instrument_key: string; interval: string; to_date?: string; from_date?: string }) =>
    apiFetch<{ inserted: number; received: number }>("/market/history/load", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  candles: (instrumentKey: string, interval = "day", options?: { from_date?: string; to_date?: string }) => {
    const params = new URLSearchParams({ interval });
    if (options?.from_date) {
      params.set("from_date", options.from_date);
    }
    if (options?.to_date) {
      params.set("to_date", options.to_date);
    }
    return apiFetch<{ candles: Array<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }> }>(
      `/market/history/${encodeURIComponent(instrumentKey)}?${params.toString()}`,
    );
  },
  trainModel: () => apiFetch<{ status: string; epochs_trained: number; best_val_acc: number; samples: number }>("/predictions/train", { method: "POST" }),
  predictions: (instrumentKeys?: string, interval = "day") => apiFetch<Array<{ instrument_key: string; signal: "BUY" | "SELL" | "HOLD"; confidence: number; last_close: number; change: number; change_pct: number; target_price: number; stop_loss: number; support: number; resistance: number; source: string; features: Record<string, number | string>; generated_at: string }>>(`/predictions/signals${instrumentKeys ? `?instrument_keys=${encodeURIComponent(instrumentKeys)}&interval=${interval}` : ""}`),
  runBacktest: (payload: { instrument_key: string; interval: string; starting_capital: number; strategy_id: number }) =>
    apiFetch<Record<string, unknown>>("/backtesting/run", { method: "POST", body: JSON.stringify(payload) }),
  toggleAutoTrading: (payload: { enabled: boolean; paper_trading: boolean; daily_loss_limit: number; max_capital_allocation: number }) =>
    apiFetch<Record<string, unknown>>("/trading/auto-trading/toggle", { method: "POST", body: JSON.stringify(payload) }),
  createStrategy: (payload: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/strategies", { method: "POST", body: JSON.stringify(payload) }),
  safe: apiFetchSafe,
};
