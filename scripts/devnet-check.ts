import { PublicKey, Connection } from "@solana/web3.js";
import { loadEnvLocal } from "./anchor-provider";

function must(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in .env.local`);
  return v;
}

function pk(name: string): PublicKey {
  return new PublicKey(must(name));
}

async function assertAccount(
  connection: Connection,
  label: string,
  key: PublicKey,
): Promise<boolean> {
  const info = await connection.getAccountInfo(key, "confirmed");
  if (!info) {
    // eslint-disable-next-line no-console
    console.log(`FAIL  ${label}: ${key.toBase58()} (missing)`);
    return false;
  }
  // eslint-disable-next-line no-console
  console.log(`OK    ${label}: ${key.toBase58()}`);
  return true;
}

async function main() {
  loadEnvLocal();
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const kycProgram = pk("NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID");
  const hookProgram = pk("NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID");
  const vaultProgram = pk("NEXT_PUBLIC_VAULT_PROGRAM_ID");
  const vkUsdcMint = pk("NEXT_PUBLIC_VKUSDC_MINT");

  const [vaultStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    vaultProgram,
  );
  const [extraAccountMetaListPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), vkUsdcMint.toBuffer()],
    hookProgram,
  );

  let ok = true;
  ok = (await assertAccount(connection, "kyc_registry program", kycProgram)) && ok;
  ok = (await assertAccount(connection, "transfer_hook program", hookProgram)) && ok;
  ok = (await assertAccount(connection, "vault program", vaultProgram)) && ok;
  ok = (await assertAccount(connection, "vkUSDC mint", vkUsdcMint)) && ok;
  ok = (await assertAccount(connection, "extra-account-metas", extraAccountMetaListPda)) && ok;
  ok = (await assertAccount(connection, "vault_state PDA", vaultStatePda)) && ok;

  if (!ok) {
    // eslint-disable-next-line no-console
    console.log(
      "\nDevnet is not fully initialized yet. Fix missing accounts/programs, then re-run this check.",
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log("\nDevnet check passed. VaultKey is ready for live demo flows.");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
