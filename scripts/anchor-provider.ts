/**
 * Shared Anchor provider for CLI scripts (issue-kyc, revoke-kyc, etc.).
 * Next.js loads `.env.local` automatically; plain `ts-node` does not, and
 * `AnchorProvider.env()` expects ANCHOR_PROVIDER_URL + ANCHOR_WALLET.
 */
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import path from "path";
import { Connection, Keypair } from "@solana/web3.js";

export function loadEnvLocal(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

export function createScriptProvider(): anchor.AnchorProvider {
  loadEnvLocal();

  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    "https://api.devnet.solana.com";

  const keypairPath =
    process.env.ANCHOR_WALLET ??
    process.env.ANCHOR_WALLET_PATH ??
    path.join(os.homedir(), ".config", "solana", "id.json");

  if (!fs.existsSync(keypairPath)) {
    throw new Error(
      `Wallet keypair not found at ${keypairPath}. ` +
        `Set ANCHOR_WALLET to your admin keypair .json path, or place it at ~/.config/solana/id.json.`,
    );
  }

  const keypairJson = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const secretKey = Array.isArray(keypairJson)
    ? Uint8Array.from(keypairJson)
    : Uint8Array.from(keypairJson.secretKey);
  const payer = Keypair.fromSecretKey(secretKey);

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(payer);
  return new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
}
