"use client";

import { BN, Idl, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { VAULT_PROGRAM_ID } from "./anchor";

export interface VaultState {
  admin: string;
  vkUsdcMint: string;
  usdcVault: string;
  totalAssets: bigint;
  totalShares: bigint;
  navPerShare: bigint;
  vaspDid: string;
}

export async function fetchVaultState(
  program: Program<Idl>,
): Promise<VaultState> {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    VAULT_PROGRAM_ID,
  );
  // @ts-expect-error dynamic IDL typing
  const state = await program.account.vaultState.fetch(pda);
  return {
    admin: state.admin.toBase58(),
    vkUsdcMint: state.vkUsdcMint.toBase58(),
    usdcVault: state.usdcVault.toBase58(),
    totalAssets: BigInt((state.totalAssets as BN).toString()),
    totalShares: BigInt((state.totalShares as BN).toString()),
    navPerShare: BigInt((state.navPerShare as BN).toString()),
    vaspDid: state.vaspDid as string,
  };
}

export function calcNavPerShare(state: VaultState): number {
  if (state.totalShares === 0n) {
    return 1.0;
  }
  const nav = Number(state.navPerShare) / 1_000_000;
  return nav;
}

