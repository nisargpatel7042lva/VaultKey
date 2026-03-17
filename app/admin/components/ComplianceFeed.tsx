"use client";

import { useEffect, useState } from "react";
import { getMockKytFeed, MockKytEvent } from "../../lib/mock-data";
import {
  BackendEvent,
  subscribeToBackendEvents,
} from "../../lib/backend";

export function ComplianceFeed() {
  const [events, setEvents] = useState<MockKytEvent[]>(getMockKytFeed());

  useEffect(() => {
    const unsubscribe = subscribeToBackendEvents((evt: BackendEvent) => {
      if (evt.type !== "kyt") return;
      const dir: MockKytEvent["direction"] =
        evt.data.direction === 0 ? "deposit" : "withdraw";
      const riskTier: MockKytEvent["riskTier"] = evt.data.riskTier;
      const row: MockKytEvent = {
        wallet: evt.data.wallet,
        amountUsdc: evt.data.amountUsdc,
        direction: dir,
        riskTier,
        timestamp: new Date(evt.data.timestamp).toLocaleTimeString(),
      };
      setEvents((prev) => [row, ...prev].slice(0, 20));
    });
    return () => unsubscribe();
  }, []);

  const badge = (risk: MockKytEvent["riskTier"]) => {
    switch (risk) {
      case "LOW":
        return "bg-green-500/10 text-green-400 border-green-500/50";
      case "MEDIUM":
        return "bg-amber-500/10 text-amber-300 border-amber-500/50";
      case "HIGH":
      default:
        return "bg-red-500/10 text-red-400 border-red-500/50";
    }
  };

  return (
    <section className="space-y-2 rounded border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Compliance feed</h2>
        <span className="text-xs text-muted">
          Live KYT events (mocked for now)
        </span>
      </div>
      <div className="space-y-2 text-xs">
        {events.map((e, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-border/40 pb-1 last:border-0 last:pb-0"
          >
            <div>
              <div>
                <span className="font-mono text-[11px]">
                  {e.wallet.slice(0, 6)}…{e.wallet.slice(-4)}
                </span>{" "}
                <span className="text-muted">
                  {e.direction === "deposit" ? "deposited" : "withdrew"}{" "}
                  {e.amountUsdc.toLocaleString()} USDC
                </span>
              </div>
              <div className="text-muted">{e.timestamp}</div>
            </div>
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 border ${badge(
                e.riskTier,
              )}`}
            >
              {e.riskTier} RISK
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

