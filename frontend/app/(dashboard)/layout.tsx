import { AppShell } from "@/components/layout";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}

