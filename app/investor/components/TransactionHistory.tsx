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
    <section className="space-y-3 rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm tracking-wide">Recent activity</h2>
        <span className="text-xs text-muted">
          Last 10 signatures (devnet)
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/50 bg-background/30">
        <table className="min-w-full text-xs">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-normal">Time</th>
              <th className="px-3 py-2 text-left font-normal">Type</th>
              <th className="px-3 py-2 text-right font-normal">Amount (USDC)</th>
              <th className="px-3 py-2 text-left font-normal">Signature</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2">{r.time}</td>
                <td className="px-3 py-2">
                  Tx
                </td>
                <td className="px-3 py-2 text-right">
                  —
                </td>
                <td className="px-3 py-2 text-muted">{r.sig}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-muted" colSpan={4}>
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

