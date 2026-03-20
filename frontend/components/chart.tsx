"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function PriceChart({ data }: { data: Array<{ timestamp: string; close: number }> }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#29d391" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#29d391" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1d2844" strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" tick={{ fill: "#8692b3", fontSize: 12 }} minTickGap={48} />
          <YAxis tick={{ fill: "#8692b3", fontSize: 12 }} width={90} />
          <Tooltip contentStyle={{ background: "#0e1325", border: "1px solid #1d2844" }} />
          <Area type="monotone" dataKey="close" stroke="#29d391" fill="url(#priceFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

