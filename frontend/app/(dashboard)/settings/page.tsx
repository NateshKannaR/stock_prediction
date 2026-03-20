"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

type UpstoxStatus = {
  connected: boolean;
  updated_at: string | null;
};

type AccountFunds = {
  available_margin: number;
  used_margin: number;
  payin_amount: number;
  notional_cash: number;
};

export default function SettingsPage() {
  const [upstoxStatus, setUpstoxStatus] = useState<UpstoxStatus | null>(null);
  const [funds, setFunds] = useState<AccountFunds | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFunds, setLoadingFunds] = useState(false);
  
  // Settings
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const status = await api.upstoxStatus();
      setUpstoxStatus(status);
      
      if (status.connected) {
        loadFunds();
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    setLoading(false);
  }

  async function loadFunds() {
    setLoadingFunds(true);
    try {
      const data = await api.accountFunds();
      setFunds(data);
    } catch (e) {
      console.error("Failed to load funds:", e);
    }
    setLoadingFunds(false);
  }

  async function bootstrapAdmin() {
    try {
      const result = await api.bootstrapAdmin();
      alert(`Admin bootstrapped: ${result.email}`);
    } catch (e: any) {
      alert("Failed to bootstrap admin: " + (e.message || e));
    }
  }

  return (
    <div>
      <PageHeader 
        title="Settings" 
        subtitle="Configure API connections, account settings, and platform preferences" 
      />

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Panel className={`text-center ${
          upstoxStatus?.connected 
            ? 'border-accent/30 bg-accent/5' 
            : 'border-danger/30 bg-danger/5'
        }`}>
          <p className="text-xs text-muted mb-1">Upstox API</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`h-3 w-3 rounded-full ${
              upstoxStatus?.connected ? 'bg-accent' : 'bg-danger'
            }`} />
            <p className={`text-xl font-bold ${
              upstoxStatus?.connected ? 'text-accent' : 'text-danger'
            }`}>
              {upstoxStatus?.connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          {upstoxStatus?.updated_at && (
            <p className="text-xs text-muted mt-2">
              Last updated: {new Date(upstoxStatus.updated_at).toLocaleString('en-IN')}
            </p>
          )}
        </Panel>

        <Panel className="text-center border-accent/30 bg-accent/5">
          <p className="text-xs text-muted mb-1">Backend API</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="h-3 w-3 rounded-full bg-accent" />
            <p className="text-xl font-bold text-accent">Connected</p>
          </div>
          <p className="text-xs text-muted mt-2">localhost:8000</p>
        </Panel>

        <Panel className="text-center border-accent/30 bg-accent/5">
          <p className="text-xs text-muted mb-1">Database</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="h-3 w-3 rounded-full bg-accent" />
            <p className="text-xl font-bold text-accent">Connected</p>
          </div>
          <p className="text-xs text-muted mt-2">MongoDB</p>
        </Panel>
      </div>

      {/* Account Funds */}
      {upstoxStatus?.connected && (
        <Panel className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">💳 Account Funds</h3>
            <button
              onClick={loadFunds}
              disabled={loadingFunds}
              className="rounded-lg border border-border px-4 py-2 text-xs text-muted hover:text-text transition disabled:opacity-40"
            >
              {loadingFunds ? 'Loading...' : '↻ Refresh'}
            </button>
          </div>
          
          {funds ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted mb-1">Available Margin</p>
                <p className="text-xl font-bold text-accent">₹{funds.available_margin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted mb-1">Used Margin</p>
                <p className="text-xl font-bold">₹{funds.used_margin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted mb-1">Payin Amount</p>
                <p className="text-xl font-bold">₹{funds.payin_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted mb-1">Notional Cash</p>
                <p className="text-xl font-bold">₹{funds.notional_cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Click refresh to load account funds</p>
          )}
        </Panel>
      )}

      {/* Upstox Configuration */}
      <Panel className="mb-6">
        <h3 className="text-lg font-semibold mb-4">🔑 Upstox API Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-2">Client ID</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Upstox Client ID"
              className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-2">Client Secret</label>
            <div className="relative">
              <input
                type={showSecrets ? "text" : "password"}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter your Upstox Client Secret"
                className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text focus:border-accent focus:outline-none pr-12"
              />
              <button
                onClick={() => setShowSecrets(!showSecrets)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
              >
                {showSecrets ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel/50 p-4">
            <p className="text-xs text-muted mb-2">💡 How to get Upstox API credentials:</p>
            <ol className="text-xs text-muted space-y-1 list-decimal list-inside">
              <li>Visit <a href="https://api.upstox.com" target="_blank" className="text-accent hover:underline">api.upstox.com</a></li>
              <li>Create a new app in the developer console</li>
              <li>Set redirect URI to: <code className="bg-border px-2 py-0.5 rounded">http://127.0.0.1:6000/callback</code></li>
              <li>Copy Client ID and Client Secret</li>
              <li>Paste them above and save</li>
            </ol>
          </div>

          <button
            className="w-full rounded-xl bg-accent px-6 py-3 font-semibold text-black hover:bg-accent/90 transition"
            onClick={() => alert('Save functionality - Connect to backend API')}
          >
            🔗 Connect Upstox Account
          </button>
        </div>
      </Panel>

      {/* Platform Settings */}
      <Panel className="mb-6">
        <h3 className="text-lg font-semibold mb-4">⚙️ Platform Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted">Currently enabled by default</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked disabled className="sr-only peer" />
              <div className="w-11 h-6 bg-accent rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-black after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-xs text-muted">Get alerts for trades and signals</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Sound Alerts</p>
              <p className="text-xs text-muted">Play sound on trade execution</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Auto-refresh Data</p>
              <p className="text-xs text-muted">Update prices every 5 seconds</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-accent rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-black after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
        </div>
      </Panel>

      {/* Admin Actions */}
      <Panel>
        <h3 className="text-lg font-semibold mb-4">🔧 Admin Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={bootstrapAdmin}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted hover:text-text hover:border-accent transition"
          >
            👤 Bootstrap Admin
          </button>
          <button
            onClick={loadSettings}
            disabled={loading}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted hover:text-text hover:border-accent transition disabled:opacity-40"
          >
            {loading ? 'Loading...' : '↻ Refresh Status'}
          </button>
          <button
            onClick={() => {
              if (confirm('Clear all cached data?')) {
                localStorage.clear();
                alert('Cache cleared!');
              }
            }}
            className="rounded-xl border border-danger/40 px-4 py-3 text-sm font-medium text-danger hover:bg-danger/10 transition"
          >
            🗑️ Clear Cache
          </button>
        </div>
      </Panel>
    </div>
  );
}
