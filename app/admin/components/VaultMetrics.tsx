"use client";

import { useEffect, useState } from "react";
import { getConnection } from "../../lib/anchor";
import { fetchVaultStateRaw } from "../../lib/vaultStateRaw";
import { fetchAllCredentials } from "../../lib/kyc";

export function VaultMetrics() {
  const [tvl, setTvl] = useState<number>(0);
  const [verified, setVerified] = useState<number>(0);
  const [yieldDistributed, setYieldDistributed] = useState<number>(0);
  const [blockedTransfers, setBlockedTransfers] = useState<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const connection = getConnection();
        const state = await fetchVaultStateRaw(connection);
        setTvl(Number(state.totalAssets) / 1_000_000);

        const creds = await fetchAllCredentials(connection).catch(() => []);
        const now = Math.floor(Date.now() / 1000);
        setVerified(
          creds.filter((c) => c.amlCleared && c.expiry > now).length,
        );

        // Mocked yield is reflected via nav_per_share updates. Report distributed yield
        // as (total_assets - total_shares) when shares are 1e6-based and first deposit is 1:1.
        const totalShares = Number(state.totalShares) / 1_000_000;
        const totalAssets = Number(state.totalAssets) / 1_000_000;
        setYieldDistributed(Math.max(0, totalAssets - totalShares));

        // Blocked transfers are tracked by the hook program, not the vault. Keep 0 here.
        setBlockedTransfers(0);
      } catch {
        setTvl(0);
        setVerified(0);
        setYieldDistributed(0);
        setBlockedTransfers(0);
      }
    })();
  }, []);

  return (
    <section className="grid grid-cols-4 gap-4 rounded border border-border bg-surface px-4 py-3 text-sm">
      <Metric label="TVL" value={`${tvl.toLocaleString()} USDC`} />
      <Metric label="Verified investors" value={verified.toString()} />
      <Metric
        label="Total yield distributed"
        value={`${yieldDistributed.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`}
      />
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

