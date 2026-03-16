"use client";

import { useMemo } from "react";
import { WalletConnectButton } from "./components/WalletConnectButton";
import { VaultStats } from "./components/VaultStats";
import { DepositForm } from "./components/DepositForm";
import { WithdrawForm } from "./components/WithdrawForm";
import { TransactionHistory } from "./components/TransactionHistory";
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
        <div className="flex items-center gap-4">
          <KycStatusBadge />
          <WalletConnectButton />
        </div>
      </header>
      <VaultStats />
      <div className="grid grid-cols-2 gap-4">
        <DepositForm />
        <WithdrawForm />
      </div>
      <TransactionHistory />
    </div>
  );
}

export default function InvestorPage() {
  return <InvestorInner />;
}

