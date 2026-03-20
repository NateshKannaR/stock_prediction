"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

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

type Strategy = {
  id: string;
  name: string;
  instruments: string[];
  indicators: any;
  entry_rules: any;
  exit_rules: any;
  risk_params: any;
  is_active: boolean;
};

export default function StrategyBuilderPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  
  // Indicators
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);
  const [sma, setSma] = useState(20);
  const [ema, setEma] = useState(50);
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbStdDev, setBbStdDev] = useState(2);
  
  // Entry Rules
  const [rsiBuyBelow, setRsiBuyBelow] = useState(35);
  const [macdCross, setMacdCross] = useState("bullish");
  const [priceAboveSma, setPriceAboveSma] = useState(false);
  
  // Exit Rules
  const [rsiSellAbove, setRsiSellAbove] = useState(65);
  const [stopLoss, setStopLoss] = useState(2.0);
  const [takeProfit, setTakeProfit] = useState(5.0);
  const [trailingStop, setTrailingStop] = useState(1.5);
  
  // Risk Parameters
  const [capitalAllocation, setCapitalAllocation] = useState(100000);
  const [maxPositions, setMaxPositions] = useState(3);

  useEffect(() => {
    loadStrategies();
  }, []);

  async function loadStrategies() {
    try {
      const data = await api.listStrategies();
      setStrategies(data);
    } catch (e) {
      console.error("Failed to load strategies:", e);
    }
  }

  function toggleStock(key: string) {
    setSelectedStocks(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  async function createStrategy() {
    if (!name.trim() || selectedStocks.length === 0) {
      alert("Please enter strategy name and select at least one stock");
      return;
    }

    setLoading(true);
    try {
      await api.createStrategy({
        name,
        instruments: selectedStocks,
        indicators: { 
          rsi: rsiPeriod, 
          macd: [macdFast, macdSlow, macdSignal], 
          moving_average: [sma, ema], 
          bollinger: [bbPeriod, bbStdDev] 
        },
        entry_rules: { 
          rsi_below: rsiBuyBelow, 
          macd_cross: macdCross,
          price_above_sma: priceAboveSma
        },
        exit_rules: { 
          rsi_above: rsiSellAbove, 
          stop_loss_pct: stopLoss, 
          trailing_stop_pct: trailingStop, 
          take_profit_pct: takeProfit 
        },
        risk_params: { 
          capital_allocation: capitalAllocation, 
          max_positions: maxPositions 
        },
      });
      
      // Reset form
      setName("");
      setSelectedStocks([]);
      setShowForm(false);
      await loadStrategies();
    } catch (e: any) {
      alert("Failed to create strategy: " + (e.message || e));
    }
    setLoading(false);
  }

  return (
    <div>
      <PageHeader 
        title="Strategy Builder" 
        subtitle="Create custom trading strategies with technical indicators and risk management rules" 
      />

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted">
            {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'} created
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-accent px-6 py-3 font-semibold text-black hover:bg-accent/90 transition"
        >
          {showForm ? '✕ Cancel' : '+ New Strategy'}
        </button>
      </div>

      {/* Strategy Form */}
      {showForm && (
        <div className="mb-6 space-y-6">
          {/* Basic Info */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">📋 Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-2">Strategy Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., RSI Momentum Strategy"
                  className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">Select Stocks * (Click to toggle)</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {STOCKS.map((stock) => (
                    <button
                      key={stock.key}
                      onClick={() => toggleStock(stock.key)}
                      className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                        selectedStocks.includes(stock.key)
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-muted hover:border-accent/50'
                      }`}
                    >
                      {stock.name}
                    </button>
                  ))}
                </div>
                {selectedStocks.length > 0 && (
                  <p className="text-xs text-accent mt-2">✓ {selectedStocks.length} stocks selected</p>
                )}
              </div>
            </div>
          </Panel>

          {/* Indicators */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">📊 Technical Indicators</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted mb-2">RSI Period</label>
                  <input
                    type="number"
                    value={rsiPeriod}
                    onChange={(e) => setRsiPeriod(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-2">MACD (Fast, Slow, Signal)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" value={macdFast} onChange={(e) => setMacdFast(Number(e.target.value))} className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                    <input type="number" value={macdSlow} onChange={(e) => setMacdSlow(Number(e.target.value))} className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                    <input type="number" value={macdSignal} onChange={(e) => setMacdSignal(Number(e.target.value))} className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted mb-2">Moving Averages (SMA, EMA)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={sma} onChange={(e) => setSma(Number(e.target.value))} placeholder="SMA" className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                    <input type="number" value={ema} onChange={(e) => setEma(Number(e.target.value))} placeholder="EMA" className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-muted mb-2">Bollinger Bands (Period, Std Dev)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={bbPeriod} onChange={(e) => setBbPeriod(Number(e.target.value))} className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                    <input type="number" value={bbStdDev} onChange={(e) => setBbStdDev(Number(e.target.value))} className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Entry Rules */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">🟢 Entry Rules (When to BUY)</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted mb-2">RSI Below (Oversold)</label>
                  <input
                    type="number"
                    value={rsiBuyBelow}
                    onChange={(e) => setRsiBuyBelow(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
                  />
                  <p className="text-xs text-muted mt-1">Buy when RSI drops below this value</p>
                </div>
                <div>
                  <label className="block text-sm text-muted mb-2">MACD Crossover</label>
                  <select
                    value={macdCross}
                    onChange={(e) => setMacdCross(e.target.value)}
                    className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
                  >
                    <option value="bullish">Bullish (MACD crosses above signal)</option>
                    <option value="bearish">Bearish (MACD crosses below signal)</option>
                    <option value="any">Any crossover</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="priceAboveSma"
                  checked={priceAboveSma}
                  onChange={(e) => setPriceAboveSma(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="priceAboveSma" className="text-sm text-text cursor-pointer">
                  Price must be above SMA (uptrend confirmation)
                </label>
              </div>
            </div>
          </Panel>

          {/* Exit Rules */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">🔴 Exit Rules (When to SELL)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-2">RSI Above (Overbought)</label>
                <input
                  type="number"
                  value={rsiSellAbove}
                  onChange={(e) => setRsiSellAbove(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
                />
                <p className="text-xs text-muted mt-1">Sell when RSI rises above this value</p>
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">Stop Loss (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
                />
                <p className="text-xs text-muted mt-1">Exit if price drops by this %</p>
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">Take Profit (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
                />
                <p className="text-xs text-muted mt-1">Exit if price rises by this %</p>
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">Trailing Stop (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={trailingStop}
                  onChange={(e) => setTrailingStop(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
                />
                <p className="text-xs text-muted mt-1">Lock in profits as price rises</p>
              </div>
            </div>
          </Panel>

          {/* Risk Management */}
          <Panel>
            <h3 className="text-lg font-semibold mb-4">💰 Risk Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-2">Capital Allocation (₹)</label>
                <input
                  type="number"
                  value={capitalAllocation}
                  onChange={(e) => setCapitalAllocation(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
                />
                <p className="text-xs text-muted mt-1">Total capital for this strategy</p>
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">Max Positions</label>
                <input
                  type="number"
                  value={maxPositions}
                  onChange={(e) => setMaxPositions(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
                />
                <p className="text-xs text-muted mt-1">Maximum concurrent trades</p>
              </div>
            </div>
          </Panel>

          {/* Create Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-border px-6 py-3 font-medium text-muted hover:text-text transition"
            >
              Cancel
            </button>
            <button
              onClick={createStrategy}
              disabled={loading}
              className="rounded-xl bg-accent px-8 py-3 font-semibold text-black hover:bg-accent/90 transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : '✓ Create Strategy'}
            </button>
          </div>
        </div>
      )}

      {/* Strategies List */}
      {strategies.length === 0 && !showForm ? (
        <Panel>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">No Strategies Yet</h3>
            <p className="text-sm text-muted mb-6">
              Create your first trading strategy by clicking the "New Strategy" button above.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {strategies.map((strategy) => (
            <Panel key={strategy.id} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{strategy.name}</h3>
                  <p className="text-xs text-muted mt-1">
                    {strategy.instruments.length} {strategy.instruments.length === 1 ? 'stock' : 'stocks'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  strategy.is_active 
                    ? 'bg-accent/20 text-accent border border-accent/40' 
                    : 'bg-border text-muted'
                }`}>
                  {strategy.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Entry RSI:</span>
                  <span className="font-medium">{'<'} {strategy.entry_rules.rsi_below}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Exit RSI:</span>
                  <span className="font-medium">{'>'} {strategy.exit_rules.rsi_above}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Stop Loss:</span>
                  <span className="font-medium text-danger">-{strategy.exit_rules.stop_loss_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Take Profit:</span>
                  <span className="font-medium text-accent">+{strategy.exit_rules.take_profit_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Capital:</span>
                  <span className="font-medium">₹{strategy.risk_params.capital_allocation.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex gap-2">
                <button className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:text-text hover:border-accent transition">
                  📊 Backtest
                </button>
                <button className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:text-text hover:border-accent transition">
                  ⚙️ Edit
                </button>
                <button className="flex-1 rounded-lg border border-danger/40 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 transition">
                  🗑️ Delete
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
