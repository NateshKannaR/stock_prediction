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
  const [selectedInstrumentKey, setSelectedInstrumentKey] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<ChartRangeKey>("1D");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [quotesLoading, setQuotesLoading] = useState<boolean>(true);
  const [quoteErrorMessage, setQuoteErrorMessage] = useState<string | null>(null);
  const [chartErrorMessage, setChartErrorMessage] = useState<string | null>(null);
  const [chartData, setChartData] = useState<Array<{ timestamp: string; close: number }>>([]);

  useEffect(() => {
    if (!instruments.some((instrument) => instrument.instrumentKey === selectedInstrumentKey) && selectedInstrumentKey !== "") {
      setSelectedInstrumentKey("");
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
      {/* Watchlist Grid - Always Visible */}
      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-text">Live Watchlist</h2>
            <p className="mt-1 text-sm text-muted">
              Click any stock to view detailed quote information and price chart
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted">Tracked: {instruments.length} stocks</div>
            <div className="text-xs text-muted">Updated: {formatTime(lastUpdated)}</div>
          </div>
        </div>

        {quoteErrorMessage ? (
          <div className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
            ⚠️ {quoteErrorMessage}
          </div>
        ) : null}

        {quotesLoading && rows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-panel/50 px-4 py-3 animate-pulse">
                <div className="h-4 bg-border rounded w-32 mb-2"></div>
                <div className="h-5 bg-border rounded w-24"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const isPositive = (row.netChange ?? 0) >= 0;

              return (
                <button
                  key={row.instrumentKey}
                  type="button"
                  onClick={() => setSelectedInstrumentKey(row.instrumentKey)}
                  className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-left transition hover:border-accent/50 hover:bg-panel/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="min-w-0">
                      <div className="font-semibold text-text">{row.symbol}</div>
                      <div className="text-xs text-muted truncate">{row.label}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-text">{formatPrice(row.lastPrice)}</div>
                      <div className={`text-sm font-medium ${isPositive ? "text-accent" : "text-danger"}`}>
                        {formatChange(row.netChange)} ({formatPercent(row.percentChange)})
                      </div>
                    </div>
                    <div className="text-muted">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Stock Details Modal - Overlay */}
      {selectedInstrumentKey && selectedRow && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedInstrumentKey("");
            }
          }}
        >
          <div 
            className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-panel p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close Button */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-accent">{selectedRow.instrumentKey}</p>
                <h2 className="mt-2 text-3xl font-semibold text-text">{selectedRow.symbol}</h2>
                <div className="mt-3 flex flex-wrap items-baseline gap-3">
                  <p className="text-4xl font-semibold text-text">{formatPrice(selectedRow.lastPrice)}</p>
                  <p className={selectedPositive ? "text-accent" : "text-danger"}>
                    {formatChange(selectedRow.netChange)} ({formatPercent(selectedRow.percentChange)})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstrumentKey("")}
                className="text-3xl text-muted hover:text-text transition flex-shrink-0 ml-4 cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* OHLC Data */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
              <div className="rounded-xl border border-border bg-[#0f162a]/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Open</p>
                <p className="mt-2 text-xl font-medium text-text">{formatPrice(selectedRow.open)}</p>
              </div>
              <div className="rounded-xl border border-border bg-[#0f162a]/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">High</p>
                <p className="mt-2 text-xl font-medium text-accent">{formatPrice(selectedRow.high)}</p>
              </div>
              <div className="rounded-xl border border-border bg-[#0f162a]/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Low</p>
                <p className="mt-2 text-xl font-medium text-danger">{formatPrice(selectedRow.low)}</p>
              </div>
              <div className="rounded-xl border border-border bg-[#0f162a]/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Prev Close</p>
                <p className="mt-2 text-xl font-medium text-text">{formatPrice(selectedRow.close)}</p>
              </div>
              <div className="rounded-xl border border-border bg-[#0f162a]/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Volume</p>
                <p className="mt-2 text-xl font-medium text-text">{formatNumber(selectedRow.volume)}</p>
              </div>
            </div>

            {/* Price Chart */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text">Price Chart</h3>
                <div className="flex flex-wrap gap-2">
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
              </div>
              {chartData.length > 0 ? (
                <PriceChart data={chartData} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
                  {quotesLoading
                    ? "Loading chart data..."
                    : chartErrorMessage
                    ? chartErrorMessage
                    : `No chart data available for ${selectedRow.symbol}`}
                </div>
              )}
            </div>

            {/* Additional Info */}
            <div className="mt-6 text-xs text-muted text-center">
              Last updated: {formatTime(lastUpdated)} • Click outside or press × to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
