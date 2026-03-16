"use client";

import { PublicKey, Connection } from "@solana/web3.js";
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

function readI64LE(buf: Buffer, offset: number): number {
  // Anchor uses i64 little-endian.
  // JS can't safely represent full i64 range; our timestamps fit in i53.
  const lo = buf.readUInt32LE(offset);
  const hi = buf.readInt32LE(offset + 4);
  return hi * 2 ** 32 + lo;
}

export async function fetchCredential(
  connection: Connection,
  wallet: PublicKey,
): Promise<KycCredential | null> {
  const [pda] = deriveCredentialPDA(wallet);
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info?.data) return null;

  const data = Buffer.from(info.data);
  // Layout (Anchor):
  // [0..8) discriminator
  // [8..40) wallet pubkey
  // [40] tier u8
  // [41..49) issued_at i64
  // [49..57) expiry i64
  // [57] aml_cleared bool
  // [58] bump u8
  if (data.length < 59) return null;

  const walletPk = new PublicKey(data.subarray(8, 40)).toBase58();
  const tier = data.readUInt8(40);
  const issuedAt = readI64LE(data, 41);
  const expiry = readI64LE(data, 49);
  const amlCleared = data.readUInt8(57) === 1;

  return { wallet: walletPk, tier, issuedAt, expiry, amlCleared };
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

