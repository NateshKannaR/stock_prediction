import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

export default async function PortfolioPage() {
  const positions = await api.positions().catch(() => []);
  return (
    <div>
      <PageHeader title="Portfolio" subtitle="Net exposure, average prices, and tracked positions derived from stored executions." />
      <Panel>
        {positions.length === 0 ? (
          <p className="text-sm text-muted">No positions available yet.</p>
        ) : (
          <div className="space-y-3">
            {positions.map((position) => (
              <div key={position.instrument_key} className="grid grid-cols-4 gap-4 rounded-xl border border-border px-4 py-3 text-sm">
                <div>{position.instrument_key}</div>
                <div>{position.net_quantity}</div>
                <div>₹{position.average_price.toFixed(2)}</div>
                <div>₹{position.last_trade_price.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

