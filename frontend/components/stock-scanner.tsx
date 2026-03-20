"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type StockScore = {
  symbol: string;
  intraday_score: number;
  volatility: number;
  volume_surge: number;
  trend_strength: number;
  ml_confidence: number;
  ml_signal: string;
  liquidity: number;
  momentum: number;
  sector: string;
  sentiment_score?: number;
  sentiment_label?: string;
  scan_time?: string;
};

export function StockScanner() {
  const [scanning, setScanning] = useState(false);
  const [stocks, setStocks] = useState<StockScore[]>([]);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [interval, setInterval] = useState("5minute");
  const [topN, setTopN] = useState(5);

  const runScan = async () => {
    setScanning(true);
    try {
      const result = await api.scanStocks({ interval, top_n: topN, min_candles: 100 });
      setStocks(result.top_stocks);
      setLastScan(result.scanned_at);
    } catch (error) {
      console.error("Scan failed:", error);
    } finally {
      setScanning(false);
    }
  };

  const loadLatest = async () => {
    try {
      const result = await api.latestScan(topN);
      if (result.results.length > 0) {
        setStocks(result.results);
        setLastScan(result.results[0].scan_time);
      }
    } catch (error) {
      console.error("Failed to load latest scan:", error);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const getSentimentColor = (label: string | undefined) => {
    if (label === "positive") return "text-green-400";
    if (label === "negative") return "text-red-400";
    return "text-gray-400";
  };

  const getSignalColor = (signal: string) => {
    if (signal === "BUY") return "text-green-400";
    if (signal === "SELL") return "text-red-400";
    return "text-gray-400";
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "text-green-400 font-bold";
    if (score >= 0.5) return "text-yellow-400";
    return "text-gray-400";
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Stock Scanner</h2>
          <p className="text-sm text-zinc-400">
            AI-powered intraday stock selection
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-white"
          >
            <option value="1minute">1 Min</option>
            <option value="5minute">5 Min</option>
            <option value="15minute">15 Min</option>
            <option value="30minute">30 Min</option>
          </select>
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-white"
          >
            <option value="3">Top 3</option>
            <option value="5">Top 5</option>
            <option value="10">Top 10</option>
          </select>
          <button
            onClick={runScan}
            disabled={scanning}
            className="rounded bg-blue-600 px-4 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {scanning ? "Scanning..." : "Scan Now"}
          </button>
        </div>
      </div>

      {lastScan && (
        <p className="mb-3 text-xs text-zinc-500">
          Last scan: {new Date(lastScan).toLocaleString()}
        </p>
      )}

      {stocks.length === 0 ? (
        <div className="py-8 text-center text-zinc-500">
          No scan results yet. Click "Scan Now" to find best intraday stocks.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-400">
                <th className="pb-2 font-medium">Rank</th>
                <th className="pb-2 font-medium">Symbol</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2 font-medium">Signal</th>
                <th className="pb-2 font-medium">Confidence</th>
                <th className="pb-2 font-medium">Sentiment</th>
                <th className="pb-2 font-medium">Volatility</th>
                <th className="pb-2 font-medium">Volume</th>
                <th className="pb-2 font-medium">Trend</th>
                <th className="pb-2 font-medium">Momentum</th>
                <th className="pb-2 font-medium">Sector</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock, idx) => (
                <tr
                  key={stock.symbol}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/50"
                >
                  <td className="py-3 text-zinc-400">#{idx + 1}</td>
                  <td className="py-3 font-mono text-white">
                    {stock.symbol.split("|")[1] || stock.symbol}
                  </td>
                  <td className={`py-3 ${getScoreColor(stock.intraday_score)}`}>
                    {stock.intraday_score.toFixed(3)}
                  </td>
                  <td className={`py-3 font-semibold ${getSignalColor(stock.ml_signal)}`}>
                    {stock.ml_signal}
                  </td>
                  <td className="py-3 text-zinc-300">
                    {(stock.ml_confidence * 100).toFixed(1)}%
                  </td>
                  <td className={`py-3 text-xs ${getSentimentColor(stock.sentiment_label)}`}>
                    {stock.sentiment_label || "neutral"}
                    {stock.sentiment_score !== undefined && (
                      <span className="ml-1 text-zinc-500">
                        ({stock.sentiment_score > 0 ? "+" : ""}{stock.sentiment_score.toFixed(2)})
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-zinc-300">
                    {(stock.volatility * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 text-zinc-300">
                    {stock.volume_surge.toFixed(2)}x
                  </td>
                  <td className="py-3 text-zinc-300">
                    {(stock.trend_strength * 100).toFixed(0)}
                  </td>
                  <td className={`py-3 ${stock.momentum >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(stock.momentum * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 text-xs text-zinc-400">
                    {stock.sector}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 rounded border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
        <p className="font-semibold text-zinc-300">How it works:</p>
        <ul className="mt-1 space-y-1">
          <li>• Scans 30+ liquid NSE stocks every cycle</li>
          <li>• Ranks by volatility, volume surge, trend strength, and ML confidence</li>
          <li>• Auto-trader uses top-ranked stocks with BUY/SELL signals</li>
          <li>• Refreshes every 15-30 minutes during market hours</li>
        </ul>
      </div>
    </div>
  );
}
