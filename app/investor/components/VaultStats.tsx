"use client";

import { useEffect, useState } from "react";
import { getConnection } from "../../lib/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fetchVaultStateRaw } from "../../lib/vaultStateRaw";

export function VaultStats() {
  const { publicKey } = useWallet();
  const [tvl, setTvl] = useState<number>(0);
  const [nav, setNav] = useState<number>(1.0);
  const [yourShares, setYourShares] = useState<number | null>(null);
  const [yourValue, setYourValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const connection = getConnection();
        const state = await fetchVaultStateRaw(connection);
        setTvl(Number(state.totalAssets) / 1_000_000);
        setNav(Number(state.navPerShare) / 1_000_000);

        if (publicKey) {
          // Derive vkUSDC ATA under the mint's token program (Token-2022).
          const mintInfo = await connection.getAccountInfo(state.vkUsdcMint, "confirmed");
          const tokenProgram = mintInfo?.owner;
          if (tokenProgram) {
            const ata = getAssociatedTokenAddressSync(
              state.vkUsdcMint,
              publicKey,
              false,
              tokenProgram,
              ASSOCIATED_TOKEN_PROGRAM_ID,
            );
            const bal = await connection.getTokenAccountBalance(ata, "confirmed").catch(() => null);
            const ui = bal?.value?.uiAmount ?? null;
            setYourShares(ui);
            if (ui != null) setYourValue(ui * (Number(state.navPerShare) / 1_000_000));
          }
        } else {
          setYourShares(null);
          setYourValue(null);
        }
      } catch {
        setTvl(0);
        setNav(1.0);
        setYourShares(null);
        setYourValue(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [publicKey]);

  return (
    <section className="premium-panel grid grid-cols-2 gap-4 rounded-2xl bg-surface px-5 py-4 text-sm">
      <div className="metric-tile rounded-xl p-3">
        <div className="text-xs text-muted">TVL</div>
        <div className="text-lg font-semibold">
          {loading ? "—" : `${tvl.toLocaleString()} USDC`}
        </div>
      </div>
      <div className="metric-tile rounded-xl p-3">
        <div className="text-xs text-muted">Current APY (mocked yield)</div>
        <div className="text-lg font-semibold">4.2%</div>
      </div>
      <div className="metric-tile rounded-xl p-3">
        <div className="text-xs text-muted">vkUSDC NAV</div>
        <div className="text-lg font-semibold">
          {loading ? "—" : nav.toFixed(4)} USDC
        </div>
      </div>
      <div className="metric-tile rounded-xl p-3">
        <div className="text-xs text-muted">Your balance</div>
        <div className="text-lg font-semibold">
          {loading
            ? "—"
            : publicKey
              ? `${(yourShares ?? 0).toLocaleString()} vkUSDC`
              : "Connect wallet"}
        </div>
        <div className="text-xs text-muted">
          {loading || !publicKey || yourValue == null
            ? ""
            : `≈ ${yourValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`}
        </div>
      </div>
    </section>
  );
}

