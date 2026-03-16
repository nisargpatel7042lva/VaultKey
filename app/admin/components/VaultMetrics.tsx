"use client";

import { useEffect, useState } from "react";
import { fetchVaultState, VaultState, calcNavPerShare } from "../../lib/vault";
import { getConnection } from "../../lib/anchor";
import { PublicKey } from "@solana/web3.js";

export function VaultMetrics() {
  const [state, setState] = useState<VaultState | null>(null);
  const [blockedTransfers, setBlockedTransfers] = useState<number>(3);

  useEffect(() => {
    (async () => {
      try {
        const connection = getConnection();
        const programId = new PublicKey(
          process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ??
            "11111111111111111111111111111111",
        );
        const mockProgram = { programId } as any;
        const vs = await fetchVaultState(mockProgram);
        setState(vs);
      } catch {
        setState(null);
      }
    })();
  }, []);

  const tvl =
    state && state.totalAssets
      ? Number(state.totalAssets) / 1_000_000
      : 0;

  const nav = state ? calcNavPerShare(state) : 1.0;

  return (
    <section className="grid grid-cols-4 gap-4 rounded border border-border bg-surface px-4 py-3 text-sm">
      <Metric label="TVL" value={`${tvl.toLocaleString()} USDC`} />
      <Metric label="Verified investors" value="3" />
      <Metric label="Total yield distributed" value="12,340 USDC (mock)" />
      <Metric
        label="Blocked transfer attempts"
        value={blockedTransfers.toString()}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

