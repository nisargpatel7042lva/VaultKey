/**
 * Load kyc_registry Anchor client without `anchor.workspace` (no target/idl required).
 * IDL is committed at `idl/kyc_registry.json`; program id can be overridden via env.
 */
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { loadEnvLocal } from "./anchor-provider";

export function loadKycRegistryIdl(): anchor.Idl {
  loadEnvLocal();
  const idlPath = path.join(__dirname, "..", "idl", "kyc_registry.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(
      `Missing ${idlPath}. Commit IDL or run anchor build to generate it.`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl;
  const fromEnv = process.env.NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID?.trim();
  if (fromEnv) {
    (raw as { address: string }).address = fromEnv;
  }
  return raw;
}

export function getKycRegistryProgram(
  provider: anchor.AnchorProvider,
): anchor.Program {
  return new anchor.Program(loadKycRegistryIdl(), provider);
}
