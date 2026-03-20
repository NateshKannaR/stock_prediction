"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

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

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];

type Position = {
  instrument_key: string;
  net_quantity: number;
  average_price: number;
  last_trade_price: number;
};

type Summary = {
  total_capital: number;
  realized_pnl: number;
  open_positions: number;
  trade_count: number;
};

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [posData, sumData] = await Promise.all([
        api.positions(),
        api.portfolioSummary(),
      ]);
      setPositions(posData);
      setSummary(sumData);

      // Load current prices for positions
      if (posData.length > 0) {
        try {
          const quotes = await api.marketQuotes(posData.map(p => p.instrument_key));
          const prices: Record<string, number> = {};
          if (quotes.data) {
            Object.entries(quotes.data).forEach(([key, quote]) => {
              if (quote.last_price) prices[key] = quote.last_price;
            });
          }
          setCurrentPrices(prices);
        } catch (e) {
          console.error("Failed to load current prices:", e);
        }
      }
    } catch (e) {
      console.error("Failed to load portfolio:", e);
    }
    setLoading(false);
  }

  // Calculate metrics
  const positionsWithPnL = positions.map(pos => {
    const currentPrice = currentPrices[pos.instrument_key] || pos.last_trade_price;
    const investedValue = pos.average_price * pos.net_quantity;
    const currentValue = currentPrice * pos.net_quantity;
    const unrealizedPnL = currentValue - investedValue;
    const unrealizedPnLPct = (unrealizedPnL / investedValue) * 100;

    return {
      ...pos,
      currentPrice,
      investedValue,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPct,
      name: LABELS[pos.instrument_key] || pos.instrument_key,
    };
  });

  const totalInvested = positionsWithPnL.reduce((sum, pos) => sum + pos.investedValue, 0);
  const totalCurrent = positionsWithPnL.reduce((sum, pos) => sum + pos.currentValue, 0);
  const totalUnrealizedPnL = totalCurrent - totalInvested;
  const totalUnrealizedPnLPct = totalInvested > 0 ? (totalUnrealizedPnL / totalInvested) * 100 : 0;
  const totalPnL = (summary?.realized_pnl || 0) + totalUnrealizedPnL;

  // Chart data
  const pieData = positionsWithPnL.map(pos => ({
    name: pos.name,
    value: pos.currentValue,
  }));

  const barData = positionsWithPnL.map(pos => ({
    name: pos.name,
    pnl: pos.unrealizedPnL,
  }));

  return (
    <div>
      <PageHeader 
        title="Portfolio" 
        subtitle="Track your positions, P&L, and portfolio allocation in real-time" 
      />

      {/* Refresh Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={loadData}
          disabled={loading}
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted hover:text-text transition disabled:opacity-40"
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Total Invested</p>
          <p className="text-2xl font-bold">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </Panel>
        
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Current Value</p>
          <p className="text-2xl font-bold">₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </Panel>

        <Panel className={`text-center ${totalUnrealizedPnL >= 0 ? 'border-accent/30 bg-accent/5' : 'border-danger/30 bg-danger/5'}`}>
          <p className="text-xs text-muted mb-1">Unrealized P&L</p>
          <p className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
            {totalUnrealizedPnL >= 0 ? '+' : ''}₹{totalUnrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className={`text-xs ${totalUnrealizedPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
            {totalUnrealizedPnLPct >= 0 ? '+' : ''}{totalUnrealizedPnLPct.toFixed(2)}%
          </p>
        </Panel>

        <Panel className={`text-center ${totalPnL >= 0 ? 'border-accent/30 bg-accent/5' : 'border-danger/30 bg-danger/5'}`}>
          <p className="text-xs text-muted mb-1">Total P&L</p>
          <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
            {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-muted">Realized: ₹{(summary?.realized_pnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </Panel>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Open Positions</p>
          <p className="text-xl font-bold">{summary?.open_positions || positions.length}</p>
        </Panel>
        
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Total Trades</p>
          <p className="text-xl font-bold">{summary?.trade_count || 0}</p>
        </Panel>

        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Avg Position Size</p>
          <p className="text-xl font-bold">
            ₹{positions.length > 0 ? (totalInvested / positions.length).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
          </p>
        </Panel>

        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Win Rate</p>
          <p className="text-xl font-bold">
            {positionsWithPnL.length > 0 
              ? ((positionsWithPnL.filter(p => p.unrealizedPnL > 0).length / positionsWithPnL.length) * 100).toFixed(0)
              : '0'}%
          </p>
        </Panel>
      </div>

      {loading ? (
        <Panel className="h-64 flex items-center justify-center">
          <p className="text-muted">Loading portfolio...</p>
        </Panel>
      ) : positions.length === 0 ? (
        <Panel>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">No Positions Yet</h3>
            <p className="text-sm text-muted mb-6">
              Your portfolio is empty. Start trading to see your positions here.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="space-y-6">
          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Portfolio Allocation Pie Chart */}
            <Panel>
              <h3 className="text-lg font-semibold mb-4">Portfolio Allocation</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    formatter={(value: any) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Panel>

            {/* P&L Bar Chart */}
            <Panel>
              <h3 className="text-lg font-semibold mb-4">Unrealized P&L by Position</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#888" style={{ fontSize: '12px' }} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    formatter={(value: any) => [`₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'P&L']}
                  />
                  <Bar dataKey="pnl" fill="#10b981">
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          {/* Positions Table */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">Holdings</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="pb-3 font-medium">Stock</th>
                    <th className="pb-3 font-medium text-right">Qty</th>
                    <th className="pb-3 font-medium text-right">Avg Price</th>
                    <th className="pb-3 font-medium text-right">Current Price</th>
                    <th className="pb-3 font-medium text-right">Invested</th>
                    <th className="pb-3 font-medium text-right">Current Value</th>
                    <th className="pb-3 font-medium text-right">P&L</th>
                    <th className="pb-3 font-medium text-right">P&L %</th>
                  </tr>
                </thead>
                <tbody>
                  {positionsWithPnL.map((pos) => (
                    <tr key={pos.instrument_key} className="border-b border-border/50 hover:bg-white/5 transition">
                      <td className="py-4">
                        <div>
                          <p className="font-semibold">{pos.name}</p>
                          <p className="text-xs text-muted">{pos.instrument_key}</p>
                        </div>
                      </td>
                      <td className="py-4 text-right font-medium">{pos.net_quantity}</td>
                      <td className="py-4 text-right">₹{pos.average_price.toFixed(2)}</td>
                      <td className="py-4 text-right font-medium">₹{pos.currentPrice.toFixed(2)}</td>
                      <td className="py-4 text-right">₹{pos.investedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="py-4 text-right font-medium">₹{pos.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className={`py-4 text-right font-semibold ${pos.unrealizedPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
                        {pos.unrealizedPnL >= 0 ? '+' : ''}₹{pos.unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className={`py-4 text-right font-semibold ${pos.unrealizedPnLPct >= 0 ? 'text-accent' : 'text-danger'}`}>
                        {pos.unrealizedPnLPct >= 0 ? '+' : ''}{pos.unrealizedPnLPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <td className="pt-4" colSpan={4}>TOTAL</td>
                    <td className="pt-4 text-right">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="pt-4 text-right">₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className={`pt-4 text-right ${totalUnrealizedPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
                      {totalUnrealizedPnL >= 0 ? '+' : ''}₹{totalUnrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`pt-4 text-right ${totalUnrealizedPnLPct >= 0 ? 'text-accent' : 'text-danger'}`}>
                      {totalUnrealizedPnLPct >= 0 ? '+' : ''}{totalUnrealizedPnLPct.toFixed(2)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
