"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

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
    // For now we return mocked last 4 txns; backend listener will later
    // source this from on-chain events or fetched history.
    const now = new Date();
    const mk = (minsAgo: number, dir: TxDirection, amount: number): TxRow => ({
      sig: "mock".padEnd(8, "-"),
      direction: dir,
      amount,
      time: new Date(now.getTime() - minsAgo * 60_000).toLocaleTimeString(),
    });
    setRows([
      mk(5, "deposit", 500),
      mk(12, "withdraw", 200),
      mk(35, "deposit", 2500),
      mk(60, "withdraw", 5000),
    ]);
  }, [publicKey]);

  return (
    <section className="space-y-2 rounded border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Recent activity</h2>
        <span className="text-xs text-muted">
          Last 10 transactions (mocked)
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
                  {r.direction === "deposit" ? "Deposit" : "Withdraw"}
                </td>
                <td className="py-1 text-right">
                  {r.amount.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
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

