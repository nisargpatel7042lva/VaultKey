"use client";

import { FormEvent, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { buildWithdrawTxIxs } from "../../lib/vaultIx";
import { getConnection } from "../../lib/anchor";

const TRAVEL_RULE_THRESHOLD = 3_000; // USDC

export function WithdrawForm() {
  const { publicKey, sendTransaction } = useWallet();
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
    try {
      const { ixs, message: label } = await buildWithdrawTxIxs({
        investor: publicKey,
        sharesUi: shares,
      });
      const tx = new Transaction().add(...ixs);
      const sig = await sendTransaction(tx, getConnection());
      setMessage(`${label} submitted: ${sig.slice(0, 8)}…`);
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface px-5 py-4 text-sm shadow-[0_0_30px_rgba(34,211,238,0.10)]">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm tracking-wide">Withdraw</h2>
        <span className="text-xs text-muted">vkUSDC → USDC</span>
      </div>
      <p className="text-xs text-muted">
        Enter shares to redeem USDC. Large withdrawals trigger Travel Rule
        compliance logging.
      </p>
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="vkUSDC shares"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg border border-accent bg-accent/15 px-4 py-2 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-60"
            >
              {submitting ? "Withdrawing…" : "Withdraw"}
            </button>
          </div>
          {triggersTravelRule && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              Travel Rule applies to this withdrawal. Details will be sent to
              the receiving VASP.
            </div>
          )}
        </div>
        {message && (
          <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted">
            {message}
          </div>
        )}
      </form>
    </section>
  );
}

