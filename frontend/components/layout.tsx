import Link from "next/link";
import { PropsWithChildren } from "react";

const navigation = [
  ["Dashboard", "/dashboard"],
  ["Live Market", "/live-market"],
  ["Live News", "/live-news"],
  ["AI Predictions", "/ai-predictions"],
  ["Auto Trading", "/auto-trading"],
  ["Strategy Builder", "/strategy-builder"],
  ["Backtesting", "/backtesting"],
  ["Portfolio", "/portfolio"],
  ["Trade History", "/trade-history"],
  ["Risk Management", "/risk-management"],
  ["Settings", "/settings"],
] as const;

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background text-text">
      <div className="mx-auto grid min-h-screen max-w-[1680px] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-r border-border bg-black/20 px-6 py-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">Benx Quant</p>
            <h2 className="mt-3 text-2xl font-semibold">Trading Platform</h2>
          </div>
          <nav className="mt-10 space-y-2">
            {navigation.map(([label, href]) => (
              <Link key={href} href={href} className="block rounded-xl border border-transparent px-4 py-3 text-sm text-muted transition hover:border-border hover:bg-panel hover:text-text">
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

