"use client";

import { getMockWhitelist, MockWhitelistRow } from "../../lib/mock-data";

export function WhitelistPanel() {
  const rows: MockWhitelistRow[] = getMockWhitelist();

  const badgeClass = (status: MockWhitelistRow["status"]) => {
    switch (status) {
      case "VERIFIED":
        return "bg-green-500/10 text-green-400 border-green-500/50";
      case "PENDING":
        return "bg-amber-500/10 text-amber-300 border-amber-500/50";
      case "BLOCKED":
        return "bg-red-500/10 text-red-400 border-red-500/50";
      case "EXPIRED":
      default:
        return "bg-gray-500/10 text-gray-300 border-gray-500/50";
    }
  };

  return (
    <section className="space-y-2 rounded border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Whitelist</h2>
        <button
          type="button"
          className="rounded border border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/20"
        >
          Issue new credential
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-1 text-left font-normal">Wallet</th>
              <th className="py-1 text-left font-normal">Tier</th>
              <th className="py-1 text-left font-normal">Status</th>
              <th className="py-1 text-left font-normal">Issued</th>
              <th className="py-1 text-left font-normal">Expiry</th>
              <th className="py-1 text-right font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                <td className="py-1 font-mono text-[11px]">
                  {r.wallet.slice(0, 6)}…{r.wallet.slice(-4)}
                </td>
                <td className="py-1 capitalize">{r.tier}</td>
                <td className="py-1">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 border ${badgeClass(
                      r.status,
                    )}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="py-1">{r.issuedAt}</td>
                <td className="py-1">{r.expiry}</td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    className="rounded border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-500/20"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

