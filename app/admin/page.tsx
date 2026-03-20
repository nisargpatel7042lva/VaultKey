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
      <VaultMetrics />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WhitelistPanel />
        <ComplianceFeed />
      </div>
      <TravelRuleLog />
    </div>
  );
}

