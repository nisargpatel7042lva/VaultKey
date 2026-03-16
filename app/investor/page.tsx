"use client";

import { useMemo } from "react";
import { WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { KycStatusBadge } from "./components/KycStatusBadge";
import { CLUSTER, RPC_URL } from "../lib/anchor";

function InvestorInner() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Investor</h1>
          <p className="text-sm text-muted">
            Connected to {CLUSTER} – KYC-gated vkUSDC vault.
          </p>
        </div>
        <KycStatusBadge />
      </header>
      {/* Deposit/Withdraw forms and stats will be added here in the next step */}
      <div className="text-sm text-muted">
        RPC: {RPC_URL}. Deposit/withdraw will be enabled after program IDs are
        set in `.env.local` and the IDLs are generated.
      </div>
    </div>
  );
}

export default function InvestorPage() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <WalletProvider wallets={wallets} autoConnect={false}>
      <InvestorInner />
    </WalletProvider>
  );
}

