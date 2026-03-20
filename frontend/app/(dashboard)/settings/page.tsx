import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

export default async function SettingsPage() {
  const status = await api.upstoxStatus().catch(() => ({ connected: false, updated_at: null as string | null }));
  return (
    <div>
      <PageHeader title="Settings" subtitle="Platform connectivity, API configuration status, and operational prerequisites." />
      <Panel>
        <p className="text-sm text-muted">Upstox connection status</p>
        <p className="mt-3 text-2xl font-semibold">{status.connected ? "Connected" : "Disconnected"}</p>
        <p className="mt-2 text-sm text-muted">Last updated: {status.updated_at ?? "No token stored"}</p>
      </Panel>
    </div>
  );
}
