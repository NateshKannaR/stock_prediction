"use client";

import { useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";

const STOCKS = [
  { key: "NSE_EQ|INE002A01018", name: "RELIANCE" },
  { key: "NSE_EQ|INE467B01029", name: "TCS" },
  { key: "NSE_EQ|INE040A01034", name: "HDFCBANK" },
  { key: "NSE_EQ|INE009A01021", name: "INFY" },
  { key: "NSE_EQ|INE090A01021", name: "ICICIBANK" },
  { key: "NSE_EQ|INE062A01020", name: "SBIN" },
  { key: "NSE_EQ|INE397D01024", name: "BHARTIARTL" },
  { key: "NSE_EQ|INE154A01025", name: "ITC" },
  { key: "NSE_EQ|INE018A01030", name: "LT" },
  { key: "NSE_EQ|INE030A01027", name: "HINDUNILVR" },
];

type BacktestResult = {
  ending_capital: number;
  total_return_pct: number;
  win_rate: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  trades: number;
  equity_curve: number[];
};

export default function BacktestingPage() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState(STOCKS[3].key);
  const [capital, setCapital] = useState(500000);
  const [error, setError] = useState<string | null>(null);

  async function runBacktest() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.runBacktest({
        instrument_key: selectedStock,
        interval: "day",
        starting_capital: capital,
        strategy_id: 1,
      });
      setResult(response);
    } catch (e: any) {
      setError(e.message || "Failed to run backtest");
    }
    setLoading(false);
  }

  const chartData = result?.equity_curve.map((value, index) => ({
    day: index + 1,
    capital: value,
  })) || [];

  const profitLoss = result ? result.ending_capital - capital : 0;
  const isProfitable = profitLoss > 0;

  return (
    <div>
      <PageHeader 
        title="Backtesting" 
        subtitle="Test your trading strategy on historical data and analyze performance metrics" 
      />

      {/* Configuration Panel */}
      <Panel className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Backtest Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Stock Selection */}
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

          {/* Starting Capital */}
          <div>
            <label className="block text-sm text-muted mb-2">Starting Capital (₹)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              min="10000"
              step="10000"
            />
          </div>

          {/* Run Button */}
          <div className="flex items-end">
            <button
              onClick={runBacktest}
              disabled={loading}
              className="w-full rounded-xl bg-accent px-6 py-3 font-semibold text-black hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Running..." : "🚀 Run Backtest"}
            </button>
          </div>
        </div>

        <div className="text-xs text-muted">
          <p>• Strategy: RSI-based with MACD confirmation</p>
          <p>• Period: Last available historical data</p>
          <p>• Risk: 2% per trade with stop-loss</p>
        </div>
      </Panel>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Panel className="text-center">
              <p className="text-xs text-muted mb-1">Final Capital</p>
              <p className="text-2xl font-bold">₹{result.ending_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </Panel>
            
            <Panel className={`text-center ${isProfitable ? 'border-accent/30 bg-accent/5' : 'border-danger/30 bg-danger/5'}`}>
              <p className="text-xs text-muted mb-1">Total Return</p>
              <p className={`text-2xl font-bold ${isProfitable ? 'text-accent' : 'text-danger'}`}>
                {result.total_return_pct > 0 ? '+' : ''}{result.total_return_pct.toFixed(2)}%
              </p>
            </Panel>

            <Panel className="text-center">
              <p className="text-xs text-muted mb-1">Win Rate</p>
              <p className="text-2xl font-bold">{(result.win_rate * 100).toFixed(1)}%</p>
            </Panel>

            <Panel className="text-center">
              <p className="text-xs text-muted mb-1">Sharpe Ratio</p>
              <p className="text-2xl font-bold">{result.sharpe_ratio.toFixed(3)}</p>
            </Panel>

            <Panel className="text-center">
              <p className="text-xs text-muted mb-1">Max Drawdown</p>
              <p className="text-2xl font-bold text-danger">-{result.max_drawdown_pct.toFixed(2)}%</p>
            </Panel>
          </div>

          {/* Profit/Loss Summary */}
          <Panel>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted mb-2">Starting Capital</p>
                <p className="text-xl font-semibold">₹{capital.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-2">Ending Capital</p>
                <p className="text-xl font-semibold">₹{result.ending_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-2">Profit/Loss</p>
                <p className={`text-xl font-semibold ${isProfitable ? 'text-accent' : 'text-danger'}`}>
                  {isProfitable ? '+' : ''}₹{profitLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </Panel>

          {/* Equity Curve Chart */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">Equity Curve</h3>
            <p className="text-xs text-muted mb-4">Shows how your capital changed over time during the backtest period</p>
            
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isProfitable ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={isProfitable ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="day" 
                    stroke="#888" 
                    style={{ fontSize: '12px' }}
                    label={{ value: 'Trading Days', position: 'insideBottom', offset: -5, style: { fill: '#888' } }}
                  />
                  <YAxis 
                    stroke="#888" 
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                    label={{ value: 'Capital (₹)', angle: -90, position: 'insideLeft', style: { fill: '#888' } }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#1a1a1a', 
                      border: '1px solid #333', 
                      borderRadius: '8px' 
                    }}
                    labelStyle={{ color: '#888' }}
                    formatter={(value: any) => [`₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Capital']}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="capital" 
                    stroke={isProfitable ? "#10b981" : "#ef4444"} 
                    fill="url(#colorCapital)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center border border-border rounded-xl">
                <p className="text-muted">No equity curve data available</p>
              </div>
            )}
          </Panel>

          {/* Trade Statistics */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">Trade Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted mb-1">Total Trades</p>
                <p className="text-xl font-bold">{result.trades}</p>
              </div>
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <p className="text-xs text-muted mb-1">Winning Trades</p>
                <p className="text-xl font-bold text-accent">{Math.round(result.trades * result.win_rate)}</p>
              </div>
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
                <p className="text-xs text-muted mb-1">Losing Trades</p>
                <p className="text-xl font-bold text-danger">{result.trades - Math.round(result.trades * result.win_rate)}</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted mb-1">Avg Return/Trade</p>
                <p className="text-xl font-bold">{result.trades > 0 ? (result.total_return_pct / result.trades).toFixed(2) : '0.00'}%</p>
              </div>
            </div>
          </Panel>

          {/* Performance Analysis */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">Performance Analysis</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted">Risk-Adjusted Return (Sharpe)</span>
                <span className={`text-sm font-semibold ${result.sharpe_ratio > 1 ? 'text-accent' : result.sharpe_ratio > 0 ? 'text-yellow-400' : 'text-danger'}`}>
                  {result.sharpe_ratio.toFixed(3)} {result.sharpe_ratio > 1 ? '(Excellent)' : result.sharpe_ratio > 0.5 ? '(Good)' : '(Poor)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted">Maximum Drawdown</span>
                <span className={`text-sm font-semibold ${result.max_drawdown_pct < 10 ? 'text-accent' : result.max_drawdown_pct < 20 ? 'text-yellow-400' : 'text-danger'}`}>
                  -{result.max_drawdown_pct.toFixed(2)}% {result.max_drawdown_pct < 10 ? '(Low Risk)' : result.max_drawdown_pct < 20 ? '(Moderate)' : '(High Risk)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted">Win Rate</span>
                <span className={`text-sm font-semibold ${result.win_rate > 0.6 ? 'text-accent' : result.win_rate > 0.4 ? 'text-yellow-400' : 'text-danger'}`}>
                  {(result.win_rate * 100).toFixed(1)}% {result.win_rate > 0.6 ? '(Strong)' : result.win_rate > 0.4 ? '(Average)' : '(Weak)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted">Overall Rating</span>
                <span className={`text-sm font-semibold ${isProfitable && result.sharpe_ratio > 0.5 ? 'text-accent' : 'text-danger'}`}>
                  {isProfitable && result.sharpe_ratio > 0.5 ? '✓ Strategy Viable' : '✗ Needs Improvement'}
                </span>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Initial State */}
      {!result && !loading && (
        <Panel>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Ready to Backtest</h3>
            <p className="text-sm text-muted mb-6">
              Select a stock, set your starting capital, and run a backtest to see how the strategy performs on historical data.
            </p>
            <div className="inline-flex items-center gap-2 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-accent"></span>
              <span>Historical data loaded and ready</span>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
