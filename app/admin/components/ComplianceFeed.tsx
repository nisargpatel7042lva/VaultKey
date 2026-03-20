"use client";

import { useEffect, useState } from "react";
import {
  BackendEvent,
  subscribeToBackendEvents,
} from "../../lib/backend";

type Row = {
  wallet: string;
  amountUsdc: number;
  direction: "deposit" | "withdraw";
  riskTier: "LOW" | "MEDIUM" | "HIGH";
  timestamp: string;
};

export function ComplianceFeed() {
  const [events, setEvents] = useState<Row[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToBackendEvents((evt: BackendEvent) => {
      if (evt.type !== "kyt") return;
      const dir: Row["direction"] =
        evt.data.direction === 0 ? "deposit" : "withdraw";
      const riskTier: Row["riskTier"] = evt.data.riskTier;
      const row: Row = {
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

  const badge = (risk: Row["riskTier"]) => {
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
    <section className="space-y-3 rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm tracking-wide">Compliance feed</h2>
        <span className="text-xs text-muted">
          Live KYT events (devnet)
        </span>
      </div>
      <div className="space-y-2 text-xs max-h-80 overflow-auto pr-1">
        {events.map((e, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-background/35 px-3 py-2"
          >
            <div>
              <div>
                <span className="font-mono text-[11px]">
                  {e.wallet.slice(0, 6)}…{e.wallet.slice(-4)}
                </span>{" "}
                <span className="text-muted">
                  {e.direction === "deposit" ? "deposited" : "withdrew"}{" "}
                  {(e.amountUsdc / 1_000_000).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  USDC
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

