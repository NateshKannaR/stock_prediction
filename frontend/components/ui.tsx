"use client";

import { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Panel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("rounded-2xl border border-border bg-panel/90 p-5 shadow-panel backdrop-blur", className)}>{children}</div>;
}

export function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  const valueClass = tone === "positive" ? "text-accent" : tone === "negative" ? "text-danger" : "text-text";
  return (
    <Panel>
      <p className="text-xs uppercase tracking-[0.24em] text-muted">{label}</p>
      <p className={cn("mt-3 text-3xl font-semibold", valueClass)}>{value}</p>
    </Panel>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-semibold tracking-tight text-text">{title}</h1>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

