"use client";

import crypto from "crypto";
import {
  PublicKey,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { deriveCredentialPDA } from "./kyc";
import { USDC_MINT, VAULT_PROGRAM_ID, getConnection } from "./anchor";
import { fetchVaultStateRaw } from "./vaultStateRaw";

const DECIMALS = 6;

function ixDiscriminator(name: string): Buffer {
  // Anchor: discriminator = sha256("global:<name>")[0..8]
  const h = crypto.createHash("sha256").update(`global:${name}`).digest();
  return h.subarray(0, 8);
}

function u64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

async function tokenProgramForMint(mint: PublicKey): Promise<PublicKey> {
  const connection = getConnection();
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) throw new Error("Mint not found");
  return info.owner;
}

export function parseUiAmountToU64(ui: string): bigint {
  // supports up to 6 decimals
  const [whole, fracRaw = ""] = ui.trim().split(".");
  const frac = (fracRaw + "000000").slice(0, 6);
  const w = BigInt(whole || "0");
  const f = BigInt(frac || "0");
  return w * 1_000_000n + f;
}

export async function buildDepositTxIxs(opts: {
  investor: PublicKey;
  amountUi: string;
}): Promise<{ ixs: TransactionInstruction[]; message: string }> {
  const { investor, amountUi } = opts;
  const amount = parseUiAmountToU64(amountUi);
  if (amount <= 0n) throw new Error("Amount must be positive");

  const usdcMint = USDC_MINT;

  const state = await fetchVaultStateRaw(getConnection());
  const vkUsdcMint = state.vkUsdcMint;
  const usdcVault = state.usdcVault;

  const usdcTokenProgram = await tokenProgramForMint(usdcMint);
  const vkTokenProgram = await tokenProgramForMint(vkUsdcMint);

  const usdcAta = getAssociatedTokenAddressSync(
    usdcMint,
    investor,
    false,
    usdcTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const vkAta = getAssociatedTokenAddressSync(
    vkUsdcMint,
    investor,
    false,
    vkTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const [credentialPda] = deriveCredentialPDA(investor);

  const ixs: TransactionInstruction[] = [];
  const connection = getConnection();

  // Ensure ATAs exist.
  const [usdcAtaInfo, vkAtaInfo] = await Promise.all([
    connection.getAccountInfo(usdcAta, "confirmed"),
    connection.getAccountInfo(vkAta, "confirmed"),
  ]);

  if (!usdcAtaInfo) {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        investor,
        usdcAta,
        investor,
        usdcMint,
        usdcTokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }
  if (!vkAtaInfo) {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        investor,
        vkAta,
        investor,
        vkUsdcMint,
        vkTokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  const vaultState = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    VAULT_PROGRAM_ID,
  )[0];

  const data = Buffer.concat([ixDiscriminator("deposit_usdc"), u64LE(amount)]);

  const keys: AccountMeta[] = [
    { pubkey: vaultState, isSigner: false, isWritable: true },
    { pubkey: investor, isSigner: true, isWritable: true },
    { pubkey: usdcAta, isSigner: false, isWritable: true },
    { pubkey: usdcVault, isSigner: false, isWritable: true },
    { pubkey: vkAta, isSigner: false, isWritable: true },
    { pubkey: usdcMint, isSigner: false, isWritable: false },
    { pubkey: vkUsdcMint, isSigner: false, isWritable: false },
    { pubkey: credentialPda, isSigner: false, isWritable: false },
    { pubkey: usdcTokenProgram, isSigner: false, isWritable: false },
    { pubkey: vkTokenProgram, isSigner: false, isWritable: false },
  ];

  ixs.push(
    new TransactionInstruction({
      programId: VAULT_PROGRAM_ID,
      keys,
      data,
    }),
  );

  return {
    ixs,
    message: `Deposit ${Number(amount) / 1_000_000} USDC`,
  };
}

export async function buildWithdrawTxIxs(opts: {
  investor: PublicKey;
  sharesUi: string;
}): Promise<{ ixs: TransactionInstruction[]; message: string }> {
  const { investor, sharesUi } = opts;
  const shares = parseUiAmountToU64(sharesUi);
  if (shares <= 0n) throw new Error("Shares must be positive");

  const usdcMint = USDC_MINT;

  const state = await fetchVaultStateRaw(getConnection());
  const vkUsdcMint = state.vkUsdcMint;
  const usdcVault = state.usdcVault;

  const usdcTokenProgram = await tokenProgramForMint(usdcMint);
  const vkTokenProgram = await tokenProgramForMint(vkUsdcMint);

  const usdcAta = getAssociatedTokenAddressSync(
    usdcMint,
    investor,
    false,
    usdcTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const vkAta = getAssociatedTokenAddressSync(
    vkUsdcMint,
    investor,
    false,
    vkTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const [credentialPda] = deriveCredentialPDA(investor);

  const ixs: TransactionInstruction[] = [];
  const connection = getConnection();

  const [usdcAtaInfo, vkAtaInfo] = await Promise.all([
    connection.getAccountInfo(usdcAta, "confirmed"),
    connection.getAccountInfo(vkAta, "confirmed"),
  ]);

  if (!usdcAtaInfo) {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        investor,
        usdcAta,
        investor,
        usdcMint,
        usdcTokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }
  if (!vkAtaInfo) {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        investor,
        vkAta,
        investor,
        vkUsdcMint,
        vkTokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  const vaultState = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    VAULT_PROGRAM_ID,
  )[0];

  const data = Buffer.concat([ixDiscriminator("withdraw_usdc"), u64LE(shares)]);

  const keys: AccountMeta[] = [
    { pubkey: vaultState, isSigner: false, isWritable: true },
    { pubkey: investor, isSigner: true, isWritable: true },
    { pubkey: usdcAta, isSigner: false, isWritable: true },
    { pubkey: usdcVault, isSigner: false, isWritable: true },
    { pubkey: vkAta, isSigner: false, isWritable: true },
    { pubkey: usdcMint, isSigner: false, isWritable: false },
    { pubkey: vkUsdcMint, isSigner: false, isWritable: false },
    { pubkey: credentialPda, isSigner: false, isWritable: false },
    { pubkey: usdcTokenProgram, isSigner: false, isWritable: false },
    { pubkey: vkTokenProgram, isSigner: false, isWritable: false },
  ];

  ixs.push(
    new TransactionInstruction({
      programId: VAULT_PROGRAM_ID,
      keys,
      data,
    }),
  );

  return {
    ixs,
    message: `Withdraw ${Number(shares) / 1_000_000} vkUSDC`,
  };
}

export const TOKEN_PROGRAM_IDS = {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
};

