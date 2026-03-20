import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

export default async function RiskManagementPage() {
  const status = await api.autoTradingStatus().catch(() => ({ enabled: false, paper_trading: true, daily_loss_limit: 0, max_capital_allocation: 0 }));
  return (
    <div>
      <PageHeader title="Risk Management" subtitle="Execution guardrails, daily loss limits, and capital allocation constraints." />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <p className="text-sm text-muted">Daily loss limit</p>
          <p className="mt-3 text-3xl font-semibold">₹{status.daily_loss_limit.toFixed(2)}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-muted">Max capital allocation</p>
          <p className="mt-3 text-3xl font-semibold">₹{status.max_capital_allocation.toFixed(2)}</p>
        </Panel>
      </div>
    </div>
  );
}

