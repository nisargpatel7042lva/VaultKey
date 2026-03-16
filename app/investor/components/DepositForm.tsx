"use client";

import { FormEvent, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { isKycValid } from "../../lib/kyc";

export function DepositForm() {
  const { publicKey } = useWallet();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!publicKey) {
      setMessage("Connect wallet first.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setMessage("Enter a positive USDC amount.");
      return;
    }
    // For now we don't yet have program IDLs wired; mock success.
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setMessage("Mock deposit submitted (wire to Anchor in bucket B/C).");
    }, 500);
  };

  return (
    <section className="space-y-2 rounded border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Deposit</h2>
        <span className="text-xs text-muted">USDC → vkUSDC (1:1)</span>
      </div>
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
            placeholder="Amount in USDC"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded border border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-60"
          >
            {submitting ? "Depositing…" : "Deposit"}
          </button>
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

