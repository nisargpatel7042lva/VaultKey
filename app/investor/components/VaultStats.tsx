"use client";

import { useEffect, useState } from "react";
import { Connection } from "@solana/web3.js";
import { getConnection } from "../../lib/anchor";
import { fetchVaultState, VaultState, calcNavPerShare } from "../../lib/vault";
import { PublicKey } from "@solana/web3.js";

export function VaultStats() {
  const [state, setState] = useState<VaultState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const connection = getConnection();
        // For now we assume vault is initialized; if not, we swallow errors and show placeholders.
        const programId = new PublicKey(
          process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ??
            "11111111111111111111111111111111",
        );
        // We reuse fetchVaultState helper which derives the PDA.
        const mockProgram = { programId } as any;
        const vs = await fetchVaultState(mockProgram);
        setState(vs);
      } catch {
        setState(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tvl =
    state && state.totalAssets
      ? Number(state.totalAssets) / 1_000_000
      : 0;

  const nav = state ? calcNavPerShare(state) : 1.0;

  return (
    <section className="grid grid-cols-2 gap-4 rounded border border-border bg-surface px-4 py-3 text-sm">
      <div>
        <div className="text-xs text-muted">TVL</div>
        <div className="text-lg font-semibold">
          {loading ? "—" : `${tvl.toLocaleString()} USDC`}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted">Current APY (mock)</div>
        <div className="text-lg font-semibold">4.2%</div>
      </div>
      <div>
        <div className="text-xs text-muted">vkUSDC NAV</div>
        <div className="text-lg font-semibold">
          {loading ? "—" : nav.toFixed(4)} USDC
        </div>
      </div>
      <div>
        <div className="text-xs text-muted">Your balance</div>
        <div className="text-lg font-semibold">Coming soon</div>
      </div>
    </section>
  );
}

