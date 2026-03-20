import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

export default async function TradeHistoryPage() {
  const trades = await api.tradeHistory().catch(() => []);
  return (
    <div>
      <PageHeader title="Trade History" subtitle="Executed and paper-filled orders logged by the trading engine." />
      <Panel>
        {trades.length === 0 ? (
          <p className="text-sm text-muted">No trade history is available yet.</p>
        ) : (
          <div className="space-y-3">
            {trades.map((trade) => (
              <div key={trade.id} className="grid grid-cols-6 gap-4 rounded-xl border border-border px-4 py-3 text-sm">
                <div>{trade.instrument_key}</div>
                <div>{trade.side}</div>
                <div>{trade.quantity}</div>
                <div>₹{trade.price.toFixed(2)}</div>
                <div>{trade.status}</div>
                <div>{trade.created_at.slice(0, 19).replace("T", " ")}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

