"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { STOCKS } from "@/lib/stocks";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function ScalpingBotPage() {
  const [scalpingEnabled, setScalpingEnabled] = useState(false);
  const [scalpingInterval, setScalpingInterval] = useState("1minute");
  const [scalpingStatus, setScalpingStatus] = useState<any>(null);
  const [scalpingCapital, setScalpingCapital] = useState(50000);
  const [scalpingStock, setScalpingStock] = useState(STOCKS[0].key);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadScalpingStatus();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadScalpingStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  async function loadScalpingStatus() {
    try {
      const res = await fetch('http://localhost:8000/api/v1/trading/scalping/status');
      const data = await res.json();
      setScalpingStatus(data);
      setScalpingEnabled(data.enabled);
      setScalpingInterval(data.interval);
    } catch (e) {
      console.error("Failed to load scalping status:", e);
    }
  }

  async function toggleScalpingBot() {
    if (!scalpingEnabled && scalpingCapital < 1000) {
      alert('⚠️ Capital must be at least ₹1,000');
      return;
    }
    
    try {
      const res = await fetch('http://localhost:8000/api/v1/trading/scalping/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !scalpingEnabled,
          interval: scalpingInterval,
          stock: scalpingStock,
          paper_trading: true,
          daily_loss_limit: scalpingCapital * 0.05,
          max_capital_allocation: scalpingCapital,
        }),
      });
      const data = await res.json();
      setScalpingEnabled(data.enabled);
      await loadScalpingStatus();
      alert(data.enabled ? '✓ Scalping bot started!' : '✓ Scalping bot stopped!');
    } catch (e: any) {
      alert('✗ Failed: ' + (e.message || e));
    }
  }

  const stockName = STOCKS.find(s => s.key === scalpingStock)?.name || scalpingStock;
  const todayPnL = scalpingStatus?.today_pnl || 0;
  const isProfitable = todayPnL >= 0;

  // Chart data for P&L history (mock for now)
  const pnlHistory = scalpingStatus?.loop?.log?.slice(0, 10).reverse().map((log: any, i: number) => ({
    time: log.t,
    pnl: todayPnL * (i / 10),
  })) || [];

  return (
    <div className="animate-fadeIn">
      <PageHeader 
        title="⚡ Scalping Bot" 
        subtitle="Automated 1-minute trading bot with instant entry and exit" 
      />

      {/* Bot Status Banner */}
      <Panel className={`mb-6 ${scalpingEnabled ? 'border-accent/30 bg-accent/5' : 'border-border'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center ${scalpingEnabled ? 'bg-accent animate-pulse' : 'bg-border'}`}>
              <span className="text-2xl">{scalpingEnabled ? '▶️' : '⏸️'}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{scalpingEnabled ? 'Bot Running' : 'Bot Stopped'}</h2>
              <p className="text-sm text-muted">
                {scalpingEnabled ? `Trading ${stockName} on ${scalpingInterval === '1minute' ? '1-min' : '5-min'} timeframe` : 'Configure and start the bot'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleScalpingBot}
            className={`rounded-xl px-8 py-4 font-bold text-lg transition ${
              scalpingEnabled
                ? 'bg-danger text-white hover:bg-danger/90'
                : 'bg-accent text-black hover:bg-accent/90'
            }`}
          >
            {scalpingEnabled ? '⏹️ Stop Bot' : '▶️ Start Bot'}
          </button>
        </div>
      </Panel>

      {/* Configuration */}
      {!scalpingEnabled && (
        <Panel className="mb-6">
          <h3 className="text-lg font-semibold mb-4">⚙️ Bot Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted mb-2">Select Stock</label>
              <select
                value={scalpingStock}
                onChange={(e) => setScalpingStock(e.target.value)}
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              >
                {STOCKS.map((stock) => (
                  <option key={stock.key} value={stock.key}>
                    {stock.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Trading Capital (₹)</label>
              <input
                type="number"
                value={scalpingCapital}
                onChange={(e) => setScalpingCapital(Number(e.target.value))}
                min="1000"
                step="1000"
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Timeframe</label>
              <select
                value={scalpingInterval}
                onChange={(e) => setScalpingInterval(e.target.value)}
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              >
                <option value="1minute">1 Minute (Ultra Fast)</option>
                <option value="5minute">5 Minutes (Fast)</option>
              </select>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/30">
            <p className="text-sm text-yellow-400">
              ⚠️ <strong>Risk Settings:</strong> Daily loss limit: ₹{(scalpingCapital * 0.05).toFixed(0)} (5%) | 
              Max per trade: ₹{(scalpingCapital * 0.2).toFixed(0)} (20%) | Paper Trading Mode
            </p>
          </div>
        </Panel>
      )}

      {/* Live Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Today's Trades</p>
          <p className="text-3xl font-bold">{scalpingStatus?.today_trades || 0}</p>
        </Panel>
        <Panel className={`text-center ${isProfitable ? 'border-accent/30 bg-accent/5' : 'border-danger/30 bg-danger/5'}`}>
          <p className="text-xs text-muted mb-1">Today's P&L</p>
          <p className={`text-3xl font-bold ${isProfitable ? 'text-accent' : 'text-danger'}`}>
            {isProfitable ? '+' : ''}₹{todayPnL.toFixed(2)}
          </p>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Bot Cycles</p>
          <p className="text-3xl font-bold">{scalpingStatus?.loop?.cycles || 0}</p>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Active Position</p>
          <p className="text-3xl font-bold">{scalpingStatus?.loop?.active_position ? '✓' : '✗'}</p>
        </Panel>
      </div>

      {/* Active Position Details */}
      {scalpingStatus?.loop?.active_position && (
        <Panel className="mb-6 border-accent/30 bg-accent/5">
          <h3 className="text-lg font-semibold mb-4">📊 Active Position</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted">Stock</p>
              <p className="text-lg font-bold">{scalpingStatus.loop.active_position.instrument}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Entry Price</p>
              <p className="text-lg font-bold">₹{scalpingStatus.loop.active_position.entry.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Current Price</p>
              <p className="text-lg font-bold">₹{scalpingStatus.loop.active_position.current.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Quantity</p>
              <p className="text-lg font-bold">{scalpingStatus.loop.active_position.qty}</p>
            </div>
            <div>
              <p className="text-xs text-muted">P&L</p>
              <p className={`text-lg font-bold ${scalpingStatus.loop.active_position.pnl >= 0 ? 'text-accent' : 'text-danger'}`}>
                {scalpingStatus.loop.active_position.pnl >= 0 ? '+' : ''}₹{scalpingStatus.loop.active_position.pnl.toFixed(2)} 
                ({scalpingStatus.loop.active_position.pnl_pct.toFixed(2)}%)
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* P&L Chart */}
      {pnlHistory.length > 0 && (
        <Panel className="mb-6">
          <h3 className="text-lg font-semibold mb-4">📈 P&L Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={pnlHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" stroke="#888" style={{ fontSize: '12px' }} />
              <YAxis stroke="#888" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                formatter={(value: any) => [`₹${value.toFixed(2)}`, 'P&L']}
              />
              <Line type="monotone" dataKey="pnl" stroke={isProfitable ? '#10b981' : '#ef4444'} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* Activity Log */}
      {scalpingStatus?.loop?.log && scalpingStatus.loop.log.length > 0 && (
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📋 Activity Log</h3>
            <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-border"
              />
              Auto-refresh (3s)
            </label>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {scalpingStatus.loop.log.map((log: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-border/30 hover:bg-border/50 transition">
                <span className="text-xs text-muted font-mono">{log.t}</span>
                <span className="text-sm flex-1">{log.msg}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* How It Works */}
      <Panel className="mt-6 border-yellow-400/30 bg-yellow-400/5">
        <h3 className="text-lg font-semibold mb-3 text-yellow-400">💡 How Scalping Bot Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted">
          <div>
            <p className="font-semibold text-text mb-2">Entry Logic:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Scans every 10 seconds for signals</li>
              <li>BUY: RSI {'<'} 40 + Price rising {'>'} 0.05%</li>
              <li>SELL: RSI {'>'} 60 + Price falling {'<'} -0.05%</li>
              <li>Uses 20% of capital per trade</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-text mb-2">Exit Logic:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Time-based: After {scalpingInterval === '1minute' ? '1 minute' : '5 minutes'}</li>
              <li>Stop-loss: If loss {'>'} 0.5%</li>
              <li>Take-profit: If profit {'>'} 0.3%</li>
              <li>Exits regardless of profit/loss</li>
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}
