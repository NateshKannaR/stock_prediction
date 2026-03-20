"use client";

import { useEffect, useState } from "react";

import { PriceChart } from "@/components/chart";
import { Panel } from "@/components/ui";
import { api, type MarketQuoteRow } from "@/lib/api";

type LiveMarketInstrument = {
  label: string;
  instrumentKey: string;
};

type QuoteTableRow = LiveMarketInstrument & {
  symbol: string;
  lastPrice: number | null;
  netChange: number | null;
  percentChange: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  timestamp: string | null;
};

type ChartRangeKey = "1D" | "1W" | "1M" | "1Y";

type ChartRangeConfig = {
  key: ChartRangeKey;
  label: string;
  interval: string;
  fromDate?: string;
  toDate?: string;
  formatTimestamp: (value: string) => string;
};

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatPrice(value: number | null): string {
  return value === null ? "--" : `Rs ${value.toFixed(2)}`;
}

function formatNumber(value: number | null): string {
  return value === null ? "--" : new Intl.NumberFormat("en-IN").format(value);
}

function formatPercent(value: number | null): string {
  return value === null ? "--" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatChange(value: number | null): string {
  return value === null ? "--" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatTime(value: string | null): string {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function isoDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().slice(0, 10);
}

function isoDateYearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildRangeConfig(range: ChartRangeKey): ChartRangeConfig {
  const today = todayIsoDate();
  switch (range) {
    case "1D":
      return {
        key: "1D",
        label: "1D",
        interval: "1minute",
        formatTimestamp: (value) => value.slice(11, 16),
      };
    case "1W":
      return {
        key: "1W",
        label: "1W",
        interval: "day",
        fromDate: isoDateDaysAgo(7),
        toDate: today,
        formatTimestamp: (value) => value.slice(5, 10),
      };
    case "1M":
      return {
        key: "1M",
        label: "1M",
        interval: "day",
        fromDate: isoDateMonthsAgo(1),
        toDate: today,
        formatTimestamp: (value) => value.slice(5, 10),
      };
    case "1Y":
      return {
        key: "1Y",
        label: "1Y",
        interval: "day",
        fromDate: isoDateYearsAgo(1),
        toDate: today,
        formatTimestamp: (value) => value.slice(0, 10),
      };
  }
}

function normalizeQuote(row: MarketQuoteRow | undefined, instrument: LiveMarketInstrument): QuoteTableRow {
  const previousClose = toNumber(row?.ohlc?.close);
  const netChange = toNumber(row?.net_change);
  const percentChange = previousClose && netChange !== null ? (netChange / previousClose) * 100 : null;

  return {
    ...instrument,
    symbol: row?.symbol || instrument.label,
    lastPrice: toNumber(row?.last_price),
    netChange,
    percentChange,
    open: toNumber(row?.ohlc?.open),
    high: toNumber(row?.ohlc?.high),
    low: toNumber(row?.ohlc?.low),
    close: previousClose,
    volume: toNumber(row?.volume),
    timestamp: row?.timestamp || null,
  };
}

function findQuoteForInstrument(data: Record<string, MarketQuoteRow>, instrumentKey: string): MarketQuoteRow | undefined {
  const directMatch = data[instrumentKey];
  if (directMatch) {
    return directMatch;
  }

  return Object.values(data).find((row) => row.instrument_token === instrumentKey);
}

export function LiveMarketBoard({ instruments }: { instruments: LiveMarketInstrument[] }) {
  const [rows, setRows] = useState<QuoteTableRow[]>([]);
  const [selectedInstrumentKey, setSelectedInstrumentKey] = useState<string>(instruments[0]?.instrumentKey ?? "");
  const [selectedRange, setSelectedRange] = useState<ChartRangeKey>("1D");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [quotesLoading, setQuotesLoading] = useState<boolean>(true);
  const [quoteErrorMessage, setQuoteErrorMessage] = useState<string | null>(null);
  const [chartErrorMessage, setChartErrorMessage] = useState<string | null>(null);
  const [chartData, setChartData] = useState<Array<{ timestamp: string; close: number }>>([]);

  useEffect(() => {
    if (!instruments.some((instrument) => instrument.instrumentKey === selectedInstrumentKey)) {
      setSelectedInstrumentKey(instruments[0]?.instrumentKey ?? "");
    }
  }, [instruments, selectedInstrumentKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuotes() {
      setQuotesLoading(true);
      try {
        const response = await api.marketQuotes(instruments.map((instrument) => instrument.instrumentKey));
        if (cancelled) {
          return;
        }

        const data = response.data ?? {};
        const nextRows = instruments.map((instrument) =>
          normalizeQuote(findQuoteForInstrument(data, instrument.instrumentKey), instrument),
        );
        setRows(nextRows);
        setLastUpdated(new Date().toISOString());
        setQuoteErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setQuoteErrorMessage(error instanceof Error ? error.message : "Unable to fetch live market quotes.");
      } finally {
        if (!cancelled) {
          setQuotesLoading(false);
        }
      }
    }

    loadQuotes();
    const intervalId = window.setInterval(loadQuotes, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [instruments]);

  useEffect(() => {
    let cancelled = false;

    async function loadCandles() {
      if (!selectedInstrumentKey) {
        setChartData([]);
        setChartErrorMessage(null);
        return;
      }

      try {
        const rangeConfig = buildRangeConfig(selectedRange);
        let candles = await api.candles(selectedInstrumentKey, rangeConfig.interval, {
          from_date: rangeConfig.fromDate,
          to_date: rangeConfig.toDate,
        });
        if (candles.candles.length === 0) {
          await api.loadMarketHistory({
            instrument_key: selectedInstrumentKey,
            interval: rangeConfig.interval,
            from_date: rangeConfig.fromDate,
            to_date: rangeConfig.toDate,
          });
          candles = await api.candles(selectedInstrumentKey, rangeConfig.interval, {
            from_date: rangeConfig.fromDate,
            to_date: rangeConfig.toDate,
          });
        }
        if (cancelled) {
          return;
        }

        setChartData(
          candles.candles.map((candle) => ({
            timestamp: rangeConfig.formatTimestamp(candle.timestamp),
            close: candle.close,
          })),
        );
        setChartErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setChartData([]);
        setChartErrorMessage(error instanceof Error ? error.message : "Unable to fetch or load candle history.");
      }
    }

    loadCandles();

    return () => {
      cancelled = true;
    };
  }, [selectedInstrumentKey, selectedRange]);

  const selectedInstrument = instruments.find((instrument) => instrument.instrumentKey === selectedInstrumentKey) ?? instruments[0] ?? null;
  const selectedRow =
    rows.find((row) => row.instrumentKey === selectedInstrumentKey) ??
    (selectedInstrument
      ? {
          ...selectedInstrument,
          symbol: selectedInstrument.label,
          lastPrice: null,
          netChange: null,
          percentChange: null,
          open: null,
          high: null,
          low: null,
          close: null,
          volume: null,
          timestamp: null,
        }
      : null);
  const selectedPositive = (selectedRow?.netChange ?? 0) >= 0;
  const rangeTabs: ChartRangeKey[] = ["1D", "1W", "1M", "1Y"];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel>
          {selectedRow ? (
            <div>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-accent">{selectedRow.instrumentKey}</p>
                  <h2 className="mt-3 text-3xl font-semibold text-text">{selectedRow.symbol}</h2>
                  <div className="mt-3 flex flex-wrap items-baseline gap-3">
                    <p className="text-4xl font-semibold text-text">{formatPrice(selectedRow.lastPrice)}</p>
                    <p className={selectedPositive ? "text-accent" : "text-danger"}>
                      {formatChange(selectedRow.netChange)} ({formatPercent(selectedRow.percentChange)})
                    </p>
                  </div>
                </div>
                <div className="text-sm text-muted">Last refresh: {formatTime(lastUpdated)}</div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border bg-[#0f162a]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">Open</p>
                  <p className="mt-2 text-xl font-medium text-text">{formatPrice(selectedRow.open)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-[#0f162a]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">High</p>
                  <p className="mt-2 text-xl font-medium text-text">{formatPrice(selectedRow.high)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-[#0f162a]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">Low</p>
                  <p className="mt-2 text-xl font-medium text-text">{formatPrice(selectedRow.low)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-[#0f162a]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">Prev Close</p>
                  <p className="mt-2 text-xl font-medium text-text">{formatPrice(selectedRow.close)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-[#0f162a]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">Volume</p>
                  <p className="mt-2 text-xl font-medium text-text">{formatNumber(selectedRow.volume)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-[#0f162a]/80 p-4 sm:col-span-2 xl:col-span-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">Market Snapshot</p>
                  <p className="mt-2 text-sm text-muted">
                    Select any stock from the watchlist to inspect its live quote snapshot and stored price curve.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-4 flex flex-wrap gap-2">
                  {rangeTabs.map((range) => {
                    const active = range === selectedRange;
                    return (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setSelectedRange(range)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          active
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border bg-[#0f162a]/70 text-muted hover:border-[#33507a] hover:text-text"
                        }`}
                      >
                        {range}
                      </button>
                    );
                  })}
                </div>
                {chartData.length > 0 ? (
                  <PriceChart data={chartData} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-sm text-muted">
                    {quotesLoading
                      ? "Loading stock data..."
                      : chartErrorMessage
                      ? chartErrorMessage
                      : `No candle history is available for ${selectedRow.instrumentKey}.`}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No instruments configured for the live market page.</p>
          )}
        </Panel>

        <Panel>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-medium text-text">Live Watchlist</h2>
              <p className="mt-1 text-sm text-muted">
                Click any stock to open its quote details and price chart. This is a watchlist, not the full exchange universe.
              </p>
            </div>
            <div className="text-sm text-muted">Tracked: {instruments.length}</div>
          </div>

          {quoteErrorMessage ? <p className="mt-4 text-sm text-red-300">{quoteErrorMessage}</p> : null}

          <div className="mt-5 space-y-2">
            {quotesLoading && rows.length === 0 ? (
              <div className="rounded-2xl border border-border bg-[#0f162a]/80 px-4 py-4 text-sm text-muted">
                Loading watchlist...
              </div>
            ) : null}
            {rows.map((row) => {
              const isSelected = row.instrumentKey === selectedInstrumentKey;
              const isPositive = (row.netChange ?? 0) >= 0;

              return (
                <button
                  key={row.instrumentKey}
                  type="button"
                  onClick={() => setSelectedInstrumentKey(row.instrumentKey)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-accent bg-[#12253a] shadow-[0_0_0_1px_rgba(41,211,145,0.2)]"
                      : "border-border bg-[#0f162a]/80 hover:border-[#33507a] hover:bg-[#131c31]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-text">{row.symbol}</div>
                      <div className="mt-1 text-xs text-muted">{row.instrumentKey}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-text">{formatPrice(row.lastPrice)}</div>
                      <div className={`mt-1 text-sm ${isPositive ? "text-accent" : "text-danger"}`}>
                        {formatChange(row.netChange)} ({formatPercent(row.percentChange)})
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
