"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type RiskStatus = {
  enabled: boolean;
  paper_trading: boolean;
  daily_loss_limit: number;
  max_capital_allocation: number;
  profit_target_pct: number;
  stop_loss_pct: number;
  today_trades: number;
  today_pnl: number;
};

export default function RiskManagementPage() {
  const [status, setStatus] = useState<RiskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Editable fields
  const [dailyLossLimit, setDailyLossLimit] = useState(10000);
  const [maxCapital, setMaxCapital] = useState(100000);
  const [profitTarget, setProfitTarget] = useState(2.0);
  const [stopLoss, setStopLoss] = useState(1.0);
  const [maxPositions, setMaxPositions] = useState(5);
  const [maxPositionSize, setMaxPositionSize] = useState(20);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const data = await api.autoTradingStatus();
      setStatus(data);
      setDailyLossLimit(data.daily_loss_limit);
      setMaxCapital(data.max_capital_allocation);
      setProfitTarget(data.profit_target_pct || 2.0);
      setStopLoss(data.stop_loss_pct || 1.0);
    } catch (e) {
      console.error("Failed to load risk status:", e);
    }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await api.toggleAutoTrading({
        enabled: status?.enabled || false,
        paper_trading: status?.paper_trading || true,
        daily_loss_limit: dailyLossLimit,
        max_capital_allocation: maxCapital,
        profit_target_pct: profitTarget,
        stop_loss_pct: stopLoss,
      });
      await loadStatus();
      alert("✓ Risk settings saved successfully!");
    } catch (e: any) {
      alert("✗ Failed to save settings: " + (e.message || e));
    }
    setSaving(false);
  }

  const todayPnL = status?.today_pnl || 0;
  const lossLimitUsed = dailyLossLimit > 0 ? Math.abs(Math.min(todayPnL, 0)) : 0;
  const lossLimitPct = dailyLossLimit > 0 ? (lossLimitUsed / dailyLossLimit) * 100 : 0;
  const capitalUsed = status?.today_trades || 0;
  const riskScore = lossLimitPct > 80 ? "High" : lossLimitPct > 50 ? "Medium" : "Low";

  // Chart data
  const riskData = [
    { name: 'Used', value: lossLimitUsed, color: '#ef4444' },
    { name: 'Available', value: Math.max(0, dailyLossLimit - lossLimitUsed), color: '#10b981' },
  ];

  return (
    <div>
      <PageHeader 
        title="Risk Management" 
        subtitle="Configure trading limits, stop-loss rules, and capital allocation constraints" 
      />

      {/* Current Risk Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Today's P&L</p>
          <p className={`text-2xl font-bold ${todayPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
            {todayPnL >= 0 ? '+' : ''}₹{todayPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </Panel>
        
        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Loss Limit Used</p>
          <p className="text-2xl font-bold">{lossLimitPct.toFixed(0)}%</p>
          <p className="text-xs text-muted">₹{lossLimitUsed.toFixed(0)} / ₹{dailyLossLimit}</p>
        </Panel>

        <Panel className="text-center">
          <p className="text-xs text-muted mb-1">Today's Trades</p>
          <p className="text-2xl font-bold">{status?.today_trades || 0}</p>
        </Panel>

        <Panel className={`text-center ${
          riskScore === "High" ? 'border-danger/30 bg-danger/5' :
          riskScore === "Medium" ? 'border-yellow-400/30 bg-yellow-400/5' :
          'border-accent/30 bg-accent/5'
        }`}>
          <p className="text-xs text-muted mb-1">Risk Level</p>
          <p className={`text-2xl font-bold ${
            riskScore === "High" ? 'text-danger' :
            riskScore === "Medium" ? 'text-yellow-400' :
            'text-accent'
          }`}>
            {riskScore}
          </p>
        </Panel>
      </div>

      {/* Risk Visualization */}
      {dailyLossLimit > 0 && (
        <Panel className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Daily Loss Limit Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    formatter={(value: any) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Loss Limit:</span>
                <span className="text-lg font-semibold">₹{dailyLossLimit.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Used:</span>
                <span className="text-lg font-semibold text-danger">₹{lossLimitUsed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Remaining:</span>
                <span className="text-lg font-semibold text-accent">₹{(dailyLossLimit - lossLimitUsed).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="h-3 rounded-full bg-border overflow-hidden mt-2">
                <div 
                  className="h-full bg-danger transition-all duration-500" 
                  style={{ width: `${Math.min(lossLimitPct, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Risk Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Capital & Loss Limits */}
        <Panel>
          <h3 className="text-lg font-semibold mb-4">💰 Capital & Loss Limits</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-2">Daily Loss Limit (₹)</label>
              <input
                type="number"
                value={dailyLossLimit}
                onChange={(e) => setDailyLossLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              />
              <p className="text-xs text-muted mt-1">Maximum loss allowed per day before trading stops</p>
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Max Capital Allocation (₹)</label>
              <input
                type="number"
                value={maxCapital}
                onChange={(e) => setMaxCapital(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              />
              <p className="text-xs text-muted mt-1">Total capital available for trading</p>
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Max Position Size (%)</label>
              <input
                type="number"
                value={maxPositionSize}
                onChange={(e) => setMaxPositionSize(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              />
              <p className="text-xs text-muted mt-1">Maximum % of capital per single position</p>
            </div>
          </div>
        </Panel>

        {/* Trade Rules */}
        <Panel>
          <h3 className="text-lg font-semibold mb-4">🎯 Trade Rules</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-2">Stop Loss (%)</label>
              <input
                type="number"
                step="0.1"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              />
              <p className="text-xs text-muted mt-1">Auto-exit if position loses this %</p>
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Profit Target (%)</label>
              <input
                type="number"
                step="0.1"
                value={profitTarget}
                onChange={(e) => setProfitTarget(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              />
              <p className="text-xs text-muted mt-1">Auto-exit if position gains this %</p>
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Max Concurrent Positions</label>
              <input
                type="number"
                value={maxPositions}
                onChange={(e) => setMaxPositions(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              />
              <p className="text-xs text-muted mt-1">Maximum number of open positions at once</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Risk Guidelines */}
      <Panel className="mb-6">
        <h3 className="text-lg font-semibold mb-4">⚠️ Risk Management Guidelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-accent mt-1">✓</span>
              <div>
                <p className="text-sm font-medium">Never risk more than 2% per trade</p>
                <p className="text-xs text-muted">Protects capital from single bad trades</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-accent mt-1">✓</span>
              <div>
                <p className="text-sm font-medium">Set daily loss limit to 5% of capital</p>
                <p className="text-xs text-muted">Prevents emotional revenge trading</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-accent mt-1">✓</span>
              <div>
                <p className="text-sm font-medium">Use stop-loss on every trade</p>
                <p className="text-xs text-muted">Limits downside risk automatically</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-accent mt-1">✓</span>
              <div>
                <p className="text-sm font-medium">Diversify across 5-10 stocks</p>
                <p className="text-xs text-muted">Reduces concentration risk</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-accent mt-1">✓</span>
              <div>
                <p className="text-sm font-medium">Risk-reward ratio minimum 1:2</p>
                <p className="text-xs text-muted">Ensures profitable long-term trading</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-accent mt-1">✓</span>
              <div>
                <p className="text-sm font-medium">Review and adjust limits monthly</p>
                <p className="text-xs text-muted">Adapt to changing market conditions</p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={loadStatus}
          disabled={loading}
          className="rounded-xl border border-border px-6 py-3 font-medium text-muted hover:text-text transition disabled:opacity-50"
        >
          {loading ? 'Loading...' : '↻ Reset'}
        </button>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="rounded-xl bg-accent px-8 py-3 font-semibold text-black hover:bg-accent/90 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : '✓ Save Settings'}
        </button>
      </div>
    </div>
  );
}
