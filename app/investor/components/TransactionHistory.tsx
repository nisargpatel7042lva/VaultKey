"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getConnection } from "../../lib/anchor";

type TxDirection = "deposit" | "withdraw";

interface TxRow {
  sig: string;
  direction: TxDirection;
  amount: number;
  time: string;
}

export function TransactionHistory() {
  const { publicKey } = useWallet();
  const [rows, setRows] = useState<TxRow[]>([]);

  useEffect(() => {
    if (!publicKey) {
      setRows([]);
      return;
    }
    (async () => {
      const connection = getConnection();
      const sigs = await connection.getSignaturesForAddress(publicKey, {
        limit: 10,
      });
      // We don't infer direction/amount without IDL/event parsing in the browser.
      // Show actual signatures and times; details are visible in admin feed.
      const mapped: TxRow[] = sigs.map((s) => ({
        sig: s.signature.slice(0, 8),
        direction: "deposit",
        amount: 0,
        time: new Date((s.blockTime ?? Date.now() / 1000) * 1000).toLocaleTimeString(),
      }));
      setRows(mapped);
    })().catch(() => setRows([]));
  }, [publicKey]);

  return (
    <section className="space-y-2 rounded border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Recent activity</h2>
        <span className="text-xs text-muted">
          Last 10 signatures (devnet)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-1 text-left font-normal">Time</th>
              <th className="py-1 text-left font-normal">Type</th>
              <th className="py-1 text-right font-normal">Amount (USDC)</th>
              <th className="py-1 text-left font-normal">Signature</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                <td className="py-1">{r.time}</td>
                <td className="py-1">
                  Tx
                </td>
                <td className="py-1 text-right">
                  —
                </td>
                <td className="py-1 text-muted">{r.sig}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="py-2 text-muted" colSpan={4}>
                  Connect a wallet to see recent activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

