"use client";

import { VaultMetrics } from "./components/VaultMetrics";
import { WhitelistPanel } from "./components/WhitelistPanel";
import { ComplianceFeed } from "./components/ComplianceFeed";
import { TravelRuleLog } from "./components/TravelRuleLog";

export default function AdminPage() {
  return (
    <div className="space-y-7">
      <header className="flex items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
            Compliance Console
          </h1>
          <p className="text-sm text-muted">
            Real-time compliance view of the vkUSDC vault over devnet logs.
          </p>
        </div>
      </header>
      <section className="rounded-2xl border border-border bg-surface px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide">Admin Workflow</h2>
          <span className="text-xs text-muted">Recommended operating order</span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Step
            number="1"
            title="Manage Whitelist"
            description="Issue/revoke credentials first so user status is correct before transactions begin."
          />
          <Step
            number="2"
            title="Monitor Compliance Feed"
            description="Watch live KYT events and risk tiers as investors deposit and withdraw."
          />
          <Step
            number="3"
            title="Review Travel Rule Log"
            description="Validate high-value withdrawal events and ensure ACK references are recorded."
          />
        </div>
      </section>
      <VaultMetrics />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WhitelistPanel />
        <ComplianceFeed />
      </div>
      <TravelRuleLog />
    </div>
  );
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

