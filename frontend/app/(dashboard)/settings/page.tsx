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
      alert(`✓ Admin bootstrapped successfully!\nEmail: ${result.email}`);
    } catch (e: any) {
      alert("✗ Failed to bootstrap admin: " + (e.message || e));
    }
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader 
        title="Settings" 
        subtitle="Platform configuration and API connection status" 
      />

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Panel className={`text-center card-hover ${
          upstoxStatus?.connected 
            ? 'border-accent/30 bg-accent/5' 
            : 'border-danger/30 bg-danger/5'
        }`}>
          <p className="text-xs text-muted mb-2">Upstox API</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`h-3 w-3 rounded-full animate-pulse ${
              upstoxStatus?.connected ? 'bg-accent' : 'bg-danger'
            }`} />
            <p className={`text-xl font-bold ${
              upstoxStatus?.connected ? 'text-accent' : 'text-danger'
            }`}>
              {loading ? 'Checking...' : upstoxStatus?.connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          {upstoxStatus?.updated_at && (
            <p className="text-xs text-muted mt-2">
              {new Date(upstoxStatus.updated_at).toLocaleString('en-IN')}
            </p>
          )}
        </Panel>

        <Panel className="text-center card-hover border-accent/30 bg-accent/5">
          <p className="text-xs text-muted mb-2">Backend API</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="h-3 w-3 rounded-full bg-accent animate-pulse" />
            <p className="text-xl font-bold text-accent">Online</p>
          </div>
          <p className="text-xs text-muted mt-2">localhost:8000</p>
        </Panel>

        <Panel className="text-center card-hover border-accent/30 bg-accent/5">
          <p className="text-xs text-muted mb-2">Database</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="h-3 w-3 rounded-full bg-accent animate-pulse" />
            <p className="text-xl font-bold text-accent">Connected</p>
          </div>
          <p className="text-xs text-muted mt-2">MongoDB Atlas</p>
        </Panel>
      </div>

      {/* Account Funds - Only if Upstox is connected */}
      {upstoxStatus?.connected && (
        <Panel className="mb-6 card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">💰 Account Funds</h3>
            <button
              onClick={loadFunds}
              disabled={loadingFunds}
              className="rounded-lg border border-border px-4 py-2 text-xs text-muted hover:text-text hover:border-accent transition disabled:opacity-40"
            >
              {loadingFunds ? '⏳ Loading...' : '↻ Refresh'}
            </button>
          </div>
          
          {funds ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
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
            <div className="text-center py-8">
              <p className="text-sm text-muted">Click refresh to load account funds from Upstox</p>
            </div>
          )}
        </Panel>
      )}

      {/* Upstox Setup Guide - Only if not connected */}
      {!upstoxStatus?.connected && (
        <Panel className="mb-6 card-hover border-yellow-400/30 bg-yellow-400/5">
          <h3 className="text-lg font-semibold mb-4 text-yellow-400">⚠️ Upstox Not Connected</h3>
          <div className="space-y-3">
            <p className="text-sm text-muted">To enable live trading, you need to connect your Upstox account:</p>
            <ol className="text-sm text-muted space-y-2 list-decimal list-inside ml-2">
              <li>Visit <a href="https://api.upstox.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">api.upstox.com</a> and create an app</li>
              <li>Set redirect URI to: <code className="bg-border px-2 py-1 rounded text-xs">http://127.0.0.1:6000/callback</code></li>
              <li>Add your Client ID and Secret to the <code className="bg-border px-2 py-1 rounded text-xs">.env</code> file</li>
              <li>Restart the backend server</li>
              <li>Use the Upstox authorization flow to get access token</li>
            </ol>
            <div className="mt-4 p-3 rounded-lg bg-border/50">
              <p className="text-xs text-muted">📝 <strong>Note:</strong> Without Upstox connection, you can still use paper trading mode and backtesting features.</p>
            </div>
          </div>
        </Panel>
      )}

      {/* System Information */}
      <Panel className="mb-6 card-hover">
        <h3 className="text-lg font-semibold mb-4">📊 System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted">Platform Version</span>
              <span className="text-sm font-medium">v1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted">Backend API</span>
              <span className="text-sm font-medium">FastAPI + Python</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted">Frontend</span>
              <span className="text-sm font-medium">Next.js 15 + React</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted">Database</span>
              <span className="text-sm font-medium">MongoDB Atlas</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted">AI Model</span>
              <span className="text-sm font-medium">LSTM + Technical Indicators</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted">Market Data</span>
              <span className="text-sm font-medium">Upstox API</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Admin Actions */}
      <Panel className="card-hover">
        <h3 className="text-lg font-semibold mb-4">🔧 Admin Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={bootstrapAdmin}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted hover:text-text hover:border-accent hover:bg-accent/5 transition"
          >
            👤 Bootstrap Admin User
          </button>
          <button
            onClick={loadSettings}
            disabled={loading}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted hover:text-text hover:border-accent hover:bg-accent/5 transition disabled:opacity-40"
          >
            {loading ? '⏳ Loading...' : '↻ Refresh All Status'}
          </button>
          <button
            onClick={() => {
              if (confirm('⚠️ This will clear all cached data. Continue?')) {
                localStorage.clear();
                sessionStorage.clear();
                alert('✓ Cache cleared successfully!');
                window.location.reload();
              }
            }}
            className="rounded-xl border border-danger/40 px-4 py-3 text-sm font-medium text-danger hover:bg-danger/10 transition"
          >
            🗑️ Clear Browser Cache
          </button>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-border/30">
          <p className="text-xs text-muted">
            💡 <strong>Tip:</strong> Use "Bootstrap Admin" to create the default admin user if you haven't already. 
            This is required for authentication.
          </p>
        </div>
      </Panel>
    </div>
  );
}
