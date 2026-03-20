import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Benx Quant Trading Platform",
  description: "AI-powered stock prediction and automated trading platform for Upstox",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
