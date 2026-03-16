"use client";

import type { AnchorProvider, Idl } from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { KYC_REGISTRY_PROGRAM_ID } from "./anchor";

// These types mirror the on-chain account fields; kept minimal for UI use.
export interface KycCredential {
  wallet: string;
  tier: number;
  issuedAt: number;
  expiry: number;
  amlCleared: boolean;
}

export function deriveCredentialPDA(
  wallet: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("kyc"), wallet.toBuffer()],
    KYC_REGISTRY_PROGRAM_ID,
  );
}

export async function fetchCredential(
  program: Program<Idl>,
  wallet: PublicKey,
): Promise<KycCredential | null> {
  const [pda] = deriveCredentialPDA(wallet);
  try {
    // @ts-expect-error dynamic IDL typing
    const account = await program.account.kycCredential.fetch(pda);
    return {
      wallet: account.wallet.toBase58(),
      tier: account.tier,
      issuedAt: (account.issuedAt as BN).toNumber(),
      expiry: (account.expiry as BN).toNumber(),
      amlCleared: account.amlCleared,
    };
  } catch {
    return null;
  }
}

export function isKycValid(cred: KycCredential | null): {
  valid: boolean;
  reason?: string;
} {
  if (!cred) {
    return { valid: false, reason: "No credential found" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (cred.expiry <= now) {
    return { valid: false, reason: "Credential expired" };
  }
  if (!cred.amlCleared) {
    return { valid: false, reason: "Wallet AML flagged" };
  }
  return { valid: true };
}

