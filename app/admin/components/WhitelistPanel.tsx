"use client";

import { useEffect, useState } from "react";
import { getConnection } from "../../lib/anchor";
import { fetchAllCredentials, KycCredential } from "../../lib/kyc";

type Status = "VERIFIED" | "BLOCKED" | "EXPIRED";

export function WhitelistPanel() {
  const [rows, setRows] = useState<KycCredential[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const conn = getConnection();
        const creds = await fetchAllCredentials(conn);
        setRows(creds);
      } catch {
        setRows([]);
      }
    })();
  }, []);

  const badgeClass = (status: Status) => {
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const now = Math.floor(Date.now() / 1000);
              let status: Status = "VERIFIED";
              if (!r.amlCleared) status = "BLOCKED";
              else if (r.expiry <= now) status = "EXPIRED";
              const tierLabel = r.tier === 2 ? "institutional" : "retail";

              const issuedDate = new Date(r.issuedAt * 1000)
                .toISOString()
                .slice(0, 10);
              const expiryDate = new Date(r.expiry * 1000)
                .toISOString()
                .slice(0, 10);

              return (
              <tr key={i} className="border-b border-border/40 last:border-0">
                <td className="py-1 font-mono text-[11px]">
                  {r.wallet.slice(0, 6)}…{r.wallet.slice(-4)}
                </td>
                <td className="py-1 capitalize">{tierLabel}</td>
                <td className="py-1">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 border ${badgeClass(
                      status,
                    )}`}
                  >
                    {status}
                  </span>
                </td>
                <td className="py-1">{issuedDate}</td>
                <td className="py-1">{expiryDate}</td>
              </tr>
            );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="py-2 text-muted" colSpan={5}>
                  No credentials found. Once the `kyc_registry` program is
                  deployed and credentials are issued, they will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

