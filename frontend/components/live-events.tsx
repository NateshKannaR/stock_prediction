"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import { Panel } from "@/components/ui";

type EventRow = {
  event: string;
  payload: unknown;
};

export function LiveEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:8000", {
      path: "/socket.io",
      transports: ["websocket"],
    });

    const pushEvent = (event: string) => (payload: unknown) => {
      setEvents((current) => [{ event, payload }, ...current].slice(0, 8));
    };

    socket.on("market.tick", pushEvent("market.tick"));
    socket.on("prediction.signal", pushEvent("prediction.signal"));
    socket.on("trade.executed", pushEvent("trade.executed"));
    socket.on("risk.warning", pushEvent("risk.warning"));

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Panel>
      <h2 className="text-lg font-medium">Live Event Bus</h2>
      <div className="mt-4 space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted">No live events received yet.</p>
        ) : (
          events.map((row, index) => (
            <div key={`${row.event}-${index}`} className="rounded-xl border border-border px-4 py-3">
              <p className="text-xs uppercase tracking-[0.24em] text-accent">{row.event}</p>
              <pre className="mt-3 overflow-auto text-xs text-muted">{JSON.stringify(row.payload, null, 2)}</pre>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

