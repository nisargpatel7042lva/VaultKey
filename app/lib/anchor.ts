"use client";

import { AnchorProvider, BN, Idl, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

export const CLUSTER =
  process.env.NEXT_PUBLIC_CLUSTER ?? "devnet";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const KYC_REGISTRY_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID ??
    "11111111111111111111111111111111",
);

export const TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID ??
    "11111111111111111111111111111111",
);

export const VAULT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ??
    "11111111111111111111111111111111",
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

