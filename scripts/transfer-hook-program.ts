import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { loadEnvLocal } from "./anchor-provider";

/** Minimal IDL for scripts that only call `initialize_extra_account_meta_list`. */
export function loadTransferHookIdl(): anchor.Idl {
  loadEnvLocal();
  const idlPath = path.join(__dirname, "..", "idl", "transfer_hook.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`Missing ${idlPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl;
  const fromEnv = process.env.NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID?.trim();
  if (fromEnv) {
    (raw as { address: string }).address = fromEnv;
  }
  return raw;
}

export function getTransferHookProgram(
  provider: anchor.AnchorProvider,
): anchor.Program {
  return new anchor.Program(loadTransferHookIdl(), provider);
}
