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
    <div className="space-y-7">
      <header className="flex items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
            Investor Console
          </h1>
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
      <section className="rounded-2xl border border-border bg-surface px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide">Start Here</h2>
          <span className="text-xs text-muted">First-time user onboarding</span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Step
            number="1"
            title="Connect Wallet"
            description="Pick a wallet and connect from the top-right. If not connected, vault actions are disabled."
          />
          <Step
            number="2"
            title="Check KYC Status"
            description="Look for VERIFIED in the badge. If status is PENDING/EXPIRED/BLOCKED, contact admin to update credential."
          />
          <Step
            number="3"
            title="Deposit or Withdraw"
            description="Use Deposit to mint vkUSDC and Withdraw to redeem USDC. Then verify activity in the history table."
          />
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-accent/60 text-[11px] font-semibold text-accent">
        {number}
      </div>
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1 text-xs text-muted">{description}</p>
    </div>
  );
}

