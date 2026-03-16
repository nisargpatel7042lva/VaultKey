"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchCredential, isKycValid, KycCredential } from "../../lib/kyc";
import { getProvider } from "../../lib/anchor";
import { Program, Idl } from "@coral-xyz/anchor";

type Status = "unknown" | "verified" | "blocked" | "expired";

export function KycStatusBadge({ program }: { program: Program<Idl> }) {
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<Status>("unknown");
  const [reason, setReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!publicKey) {
      setStatus("unknown");
      setReason(undefined);
      return;
    }

    (async () => {
      const cred = await fetchCredential(program, publicKey);
      const res = isKycValid(cred);
      if (!cred) {
        setStatus("blocked");
        setReason(res.reason);
      } else if (!res.valid) {
        setStatus(res.reason === "Wallet AML flagged" ? "blocked" : "expired");
        setReason(res.reason);
      } else {
        setStatus("verified");
        setReason(undefined);
      }
    })();
  }, [publicKey, program]);

  const label =
    status === "verified"
      ? "VERIFIED"
      : status === "blocked"
      ? "BLOCKED"
      : status === "expired"
      ? "EXPIRED"
      : "UNKNOWN";

  const color =
    status === "verified"
      ? "bg-green-500/10 text-green-400 border-green-500/50"
      : status === "blocked"
      ? "bg-red-500/10 text-red-400 border-red-500/50"
      : status === "expired"
      ? "bg-gray-500/10 text-gray-300 border-gray-500/50"
      : "bg-yellow-500/10 text-yellow-300 border-yellow-500/50";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${color}`}
      >
        {label}
      </span>
      {reason && (
        <span className="text-xs text-muted max-w-xs truncate" title={reason}>
          {reason}
        </span>
      )}
    </div>
  );
}

