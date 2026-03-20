"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

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

type Trade = {
  id: number;
  strategy_name: string;
  instrument_key: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  created_at: string;
};

export default function TradeHistoryPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSide, setFilterSide] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "FILLED" | "PENDING" | "REJECTED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "price" | "quantity">("date");

  useEffect(() => {
    loadTrades();
  }, []);

  async function loadTrades() {
    setLoading(true);
    try {
      const data = await api.tradeHistory();
      setTrades(data);
    } catch (e) {
      console.error("Failed to load trades:", e);
    }
    setLoading(false);
  }

  // Filter and sort trades
  let filteredTrades = trades;
  
  if (filterSide !== "ALL") {
    filteredTrades = filteredTrades.filter(t => t.side === filterSide);
  }
  
  if (filterStatus !== "ALL") {
    filteredTrades = filteredTrades.filter(t => t.status.toUpperCase() === filterStatus);
  }
  
  if (searchQuery) {
    filteredTrades = filteredTrades.filter(t => 
      LABELS[t.instrument_key]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.instrument_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.strategy_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Sort
  filteredTrades = [...filteredTrades].sort((a, b) => {
    if (sortBy === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === "price") return b.price - a.price;
    if (sortBy === "quantity") return b.quantity - a.quantity;
    return 0;
  });

  // Calculate stats
  const totalTrades = trades.length;
  const buyTrades = trades.filter(t => t.side === "BUY").length;
  const sellTrades = trades.filter(t => t.side === "SELL").length;
  const totalVolume = trades.reduce((sum, t) => sum + (t.price * t.quantity), 0);
  const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
  const filledTrades = trades.filter(t => t.status.toUpperCase() === "FILLED").length;
  const successRate = totalTrades > 0 ? (filledTrades / totalTrades) * 100 : 0;

  // Chart data - Trades over time
  const tradesByDate = trades.reduce((acc, trade) => {
    const date = new Date(trade.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    if (!acc[date]) acc[date] = { date, buy: 0, sell: 0 };
    if (trade.side === "BUY") acc[date].buy++;
    else acc[date].sell++;
    return acc;
  }, {} as Record<string, { date: string; buy: number; sell: number }>);
  
  const timelineData = Object.values(tradesByDate).slice(-30); // Last 30 days

  // Volume by stock
  const volumeByStock = trades.reduce((acc, trade) => {
    const name = LABELS[trade.instrument_key] || trade.instrument_key;
    if (!acc[name]) acc[name] = 0;
    acc[name] += trade.price * trade.quantity;
    return acc;
  }, {} as Record<string, number>);
  
  const volumeData = Object.entries(volumeByStock)
    .map(([name, volume]) => ({ name, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 10);

  return (
    <div>
      <PageHeader 
        title="Trade History" 
        subtitle="Complete record of all executed trades with analytics and filters" 
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Total Trades</p>
          <p className="text-2xl font-bold">{totalTrades}</p>
        </Panel>
        
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Buy / Sell</p>
          <p className="text-2xl font-bold">
            <span className="text-accent">{buyTrades}</span> / <span className="text-danger">{sellTrades}</span>
          </p>
        </Panel>

        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Total Volume</p>
          <p className="text-2xl font-bold">₹{(totalVolume / 100000).toFixed(1)}L</p>
        </Panel>

        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Success Rate</p>
          <p className="text-2xl font-bold">{successRate.toFixed(0)}%</p>
        </Panel>
      </div>

      {/* Charts */}
      {trades.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Trades Timeline */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">Trade Activity (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" style={{ fontSize: '12px' }} />
                <YAxis stroke="#888" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                />
                <Legend />
                <Line type="monotone" dataKey="buy" stroke="#10b981" strokeWidth={2} name="Buy" />
                <Line type="monotone" dataKey="sell" stroke="#ef4444" strokeWidth={2} name="Sell" />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          {/* Volume by Stock */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">Top 10 Stocks by Volume</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={volumeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#888" style={{ fontSize: '12px' }} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="name" stroke="#888" style={{ fontSize: '12px' }} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                  formatter={(value: any) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                />
                <Bar dataKey="volume" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}

      {/* Filters and Search */}
      <Panel className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="🔍 Search by stock, strategy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Side Filter */}
          <div>
            <select
              value={filterSide}
              onChange={(e) => setFilterSide(e.target.value as any)}
              className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
            >
              <option value="ALL">All Sides</option>
              <option value="BUY">Buy Only</option>
              <option value="SELL">Sell Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="FILLED">Filled</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Sort and Refresh */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Sort by:</span>
            <button
              onClick={() => setSortBy("date")}
              className={`rounded-lg px-3 py-1 text-xs transition ${sortBy === "date" ? 'bg-accent text-black' : 'bg-border text-muted hover:text-text'}`}
            >
              Date
            </button>
            <button
              onClick={() => setSortBy("price")}
              className={`rounded-lg px-3 py-1 text-xs transition ${sortBy === "price" ? 'bg-accent text-black' : 'bg-border text-muted hover:text-text'}`}
            >
              Price
            </button>
            <button
              onClick={() => setSortBy("quantity")}
              className={`rounded-lg px-3 py-1 text-xs transition ${sortBy === "quantity" ? 'bg-accent text-black' : 'bg-border text-muted hover:text-text'}`}
            >
              Quantity
            </button>
          </div>
          <button
            onClick={loadTrades}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-1 text-xs text-muted hover:text-text transition disabled:opacity-40"
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>
      </Panel>

      {/* Trades Table */}
      {loading ? (
        <Panel className="h-64 flex items-center justify-center">
          <p className="text-muted">Loading trades...</p>
        </Panel>
      ) : filteredTrades.length === 0 ? (
        <Panel>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">
              {trades.length === 0 ? "No Trades Yet" : "No Matching Trades"}
            </h3>
            <p className="text-sm text-muted">
              {trades.length === 0 
                ? "Your trade history will appear here once you start trading."
                : "Try adjusting your filters or search query."}
            </p>
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Trades ({filteredTrades.length})</h3>
            <span className="text-xs text-muted">Showing {filteredTrades.length} of {totalTrades} trades</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="pb-3 font-medium">Date & Time</th>
                  <th className="pb-3 font-medium">Stock</th>
                  <th className="pb-3 font-medium">Strategy</th>
                  <th className="pb-3 font-medium">Side</th>
                  <th className="pb-3 font-medium text-right">Quantity</th>
                  <th className="pb-3 font-medium text-right">Price</th>
                  <th className="pb-3 font-medium text-right">Value</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade) => {
                  const stockName = LABELS[trade.instrument_key] || trade.instrument_key;
                  const tradeValue = trade.price * trade.quantity;
                  const date = new Date(trade.created_at);
                  
                  return (
                    <tr key={trade.id} className="border-b border-border/50 hover:bg-white/5 transition">
                      <td className="py-3">
                        <div>
                          <p className="text-sm font-medium">{date.toLocaleDateString('en-IN')}</p>
                          <p className="text-xs text-muted">{date.toLocaleTimeString('en-IN')}</p>
                        </div>
                      </td>
                      <td className="py-3">
                        <div>
                          <p className="text-sm font-semibold">{stockName}</p>
                          <p className="text-xs text-muted">{trade.instrument_key}</p>
                        </div>
                      </td>
                      <td className="py-3 text-sm">{trade.strategy_name}</td>
                      <td className="py-3">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                          trade.side === "BUY" 
                            ? 'bg-accent/20 text-accent border border-accent/40'
                            : 'bg-danger/20 text-danger border border-danger/40'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-3 text-right font-medium">{trade.quantity}</td>
                      <td className="py-3 text-right">₹{trade.price.toFixed(2)}</td>
                      <td className="py-3 text-right font-semibold">₹{tradeValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="py-3">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                          trade.status.toUpperCase() === "FILLED"
                            ? 'bg-accent/20 text-accent'
                            : trade.status.toUpperCase() === "PENDING"
                            ? 'bg-yellow-400/20 text-yellow-400'
                            : 'bg-danger/20 text-danger'
                        }`}>
                          {trade.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
