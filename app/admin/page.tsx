"use client";

import { VaultMetrics } from "./components/VaultMetrics";
import { WhitelistPanel } from "./components/WhitelistPanel";
import { ComplianceFeed } from "./components/ComplianceFeed";
import { TravelRuleLog } from "./components/TravelRuleLog";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-muted">
            Real-time compliance view of the vkUSDC vault over devnet logs.
          </p>
        </div>
      </header>
      <VaultMetrics />
      <div className="grid grid-cols-2 gap-4">
        <WhitelistPanel />
        <ComplianceFeed />
      </div>
      <TravelRuleLog />
    </div>
  );
}

