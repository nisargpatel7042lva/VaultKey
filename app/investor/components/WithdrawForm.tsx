"use client";

import { FormEvent, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const TRAVEL_RULE_THRESHOLD = 3_000; // USDC

export function WithdrawForm() {
  const { publicKey } = useWallet();
  const [shares, setShares] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const amountNumber = Number(shares) || 0;
  const triggersTravelRule = amountNumber >= TRAVEL_RULE_THRESHOLD;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!publicKey) {
      setMessage("Connect wallet first.");
      return;
    }
    if (!shares || amountNumber <= 0) {
      setMessage("Enter a positive share amount.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setMessage(
        "Mock withdrawal submitted (Travel Rule event will be wired to backend in bucket E).",
      );
    }, 500);
  };

  return (
    <section className="space-y-2 rounded border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Withdraw</h2>
        <span className="text-xs text-muted">vkUSDC → USDC</span>
      </div>
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
              placeholder="vkUSDC shares"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded border border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-60"
            >
              {submitting ? "Withdrawing…" : "Withdraw"}
            </button>
          </div>
          {triggersTravelRule && (
            <div className="text-xs text-warning">
              Travel Rule applies to this withdrawal. Details will be sent to
              the receiving VASP.
            </div>
          )}
        </div>
        {message && (
          <div className="text-xs text-muted">
            {message}
          </div>
        )}
      </form>
    </section>
  );
}

