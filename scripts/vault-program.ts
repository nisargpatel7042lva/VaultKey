import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { PublicKey } from "@solana/web3.js";
import { loadEnvLocal } from "./anchor-provider";

export function loadVaultIdl(): anchor.Idl {
  loadEnvLocal();
  const idlPath = path.join(__dirname, "..", "idl", "vault.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`Missing ${idlPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl;

  const fromEnv = process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID?.trim();
  if (!fromEnv) {
    throw new Error(
      "Set NEXT_PUBLIC_VAULT_PROGRAM_ID in .env.local to your deployed vault program id.\n" +
        "Get it with: solana address -k target/deploy/vault-keypair.json\n" +
        "Or: solana program show <programId> -u devnet",
    );
  }

  let programId: PublicKey;
  try {
    programId = new PublicKey(fromEnv);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_VAULT_PROGRAM_ID is not a valid Solana address (base58, 32 bytes).\n` +
        `You have: "${fromEnv}"\n` +
        `Fix the typo in .env.local — common mistakes: wrong character (0/O, 1/l/I), truncated string.`,
    );
  }

  (raw as { address: string }).address = programId.toBase58();
  return raw;
}

export function getVaultProgram(provider: anchor.AnchorProvider): anchor.Program {
  return new anchor.Program(loadVaultIdl(), provider);
}
