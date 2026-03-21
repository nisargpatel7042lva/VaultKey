"use client";

import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

function safePublicKey(envVar: string | undefined, fallback: string): PublicKey {
  try {
    const s = (envVar ?? "").trim();
    if (
      !s ||
      s.startsWith("<") ||
      s.toUpperCase().startsWith("PUT_") ||
      s.toUpperCase() === "PUT" ||
      s.toUpperCase().includes("PUT_")
    ) {
      return new PublicKey(fallback);
    }
    return new PublicKey(s);
  } catch {
    return new PublicKey(fallback);
  }
}

export const CLUSTER =
  process.env.NEXT_PUBLIC_CLUSTER ?? "devnet";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const KYC_REGISTRY_PROGRAM_ID = safePublicKey(
  process.env.NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID,
  "11111111111111111111111111111111",
);

export const TRANSFER_HOOK_PROGRAM_ID = safePublicKey(
  process.env.NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID,
  "11111111111111111111111111111111",
);

export const VAULT_PROGRAM_ID = safePublicKey(
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID,
  "11111111111111111111111111111111",
);

/** Circle devnet USDC (SPL) — default when env is missing (e.g. stale build). */
export const DEFAULT_DEVNET_USDC_MINT =
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const USDC_MINT = safePublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT,
  DEFAULT_DEVNET_USDC_MINT,
);

export type TypedProgram<T extends Idl> = Program<T>;

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export function getProvider(wallet: any): AnchorProvider {
  const connection = getConnection();
  return new AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
}

