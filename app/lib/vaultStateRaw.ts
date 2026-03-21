"use client";

import { Connection, PublicKey } from "@solana/web3.js";
import { VAULT_PROGRAM_ID } from "./anchor";

export interface VaultStateRaw {
  admin: PublicKey;
  vkUsdcMint: PublicKey;
  usdcVault: PublicKey;
  totalAssets: bigint;
  totalShares: bigint;
  navPerShare: bigint;
  vaspDid: string;
  bump: number;
}

function readU64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.subarray(offset, offset + 32));
}

function readBorshString(
  buf: Buffer,
  offset: number,
): { value: string; next: number } {
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  return { value: buf.subarray(start, end).toString("utf8"), next: end };
}

export function deriveVaultStatePda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    VAULT_PROGRAM_ID,
  )[0];
}

export async function fetchVaultStateRaw(
  connection: Connection,
): Promise<VaultStateRaw> {
  const pda = deriveVaultStatePda();
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info?.data) {
    throw new Error(
      "VaultState not found (vault not initialized). From the repo root run: pnpm init-vault",
    );
  }
  const data = Buffer.from(info.data);

  // Layout (Anchor):
  // 8   discriminator
  // 32  admin
  // 32  vk_usdc_mint
  // 32  usdc_vault
  // 8   total_assets
  // 8   total_shares
  // 8   nav_per_share
  // 4+N vasp_did string (borsh)
  // 1   bump
  let cursor = 8;
  const admin = readPubkey(data, cursor);
  cursor += 32;
  const vkUsdcMint = readPubkey(data, cursor);
  cursor += 32;
  const usdcVault = readPubkey(data, cursor);
  cursor += 32;
  const totalAssets = readU64LE(data, cursor);
  cursor += 8;
  const totalShares = readU64LE(data, cursor);
  cursor += 8;
  const navPerShare = readU64LE(data, cursor);
  cursor += 8;

  const didRes = readBorshString(data, cursor);
  const vaspDid = didRes.value;
  cursor = didRes.next;

  const bump = data.readUInt8(cursor);

  return {
    admin,
    vkUsdcMint,
    usdcVault,
    totalAssets,
    totalShares,
    navPerShare,
    vaspDid,
    bump,
  };
}

