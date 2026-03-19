"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../../lib/backend";

type Row = {
  senderWallet: string;
  senderVasp: string;
  amountUsdc: number;
  timestamp: string;
  ackRef: string;
};

export function TravelRuleLog() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/travel-rule`);
        if (!res.ok) return;
        const data = (await res.json()) as any[];
        const mapped: Row[] = data.map((d) => ({
          senderWallet: String(d.senderWallet ?? ""),
          senderVasp: String(d.senderVasp ?? ""),
          amountUsdc: Number(d.amountUsdc ?? 0),
          timestamp: new Date(
            Number(d.timestamp ?? Date.now()),
          ).toLocaleTimeString(),
          ackRef: String(d.ack?.ref ?? ""),
        }));
        setRows(mapped);
      } catch {
        setRows([]);
      }
    };
    void load();
  }, []);

  return (
    <section className="space-y-2 rounded border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Travel Rule log</h2>
        <span className="text-xs text-muted">
          Events sent to VASP (devnet)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-1 text-left font-normal">Time</th>
              <th className="py-1 text-left font-normal">Sender</th>
              <th className="py-1 text-left font-normal">VASP</th>
              <th className="py-1 text-right font-normal">Amount (USDC)</th>
              <th className="py-1 text-left font-normal">ACK ref</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                <td className="py-1">{r.timestamp}</td>
                <td className="py-1 font-mono text-[11px]">
                  {r.senderWallet.slice(0, 6)}…{r.senderWallet.slice(-4)}
                </td>
                <td className="py-1">{r.senderVasp}</td>
                <td className="py-1 text-right">
                  {(r.amountUsdc / 1_000_000).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-1 text-success">{r.ackRef}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

