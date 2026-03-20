import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { createScriptProvider } from "./anchor-provider";
import { getKycRegistryProgram } from "./kyc-registry-program";

async function main() {
  const [walletStr, tierStr, daysStr] = process.argv.slice(2);
  if (!walletStr) {
    throw new Error(
      "Usage: pnpm issue-kyc <wallet> [tier] [expiry_days]  (tier defaults to 1)",
    );
  }

  const wallet = new PublicKey(walletStr);
  const tier = tierStr !== undefined ? Number(tierStr) : 1;
  const expiryDays = daysStr !== undefined ? Number(daysStr) : 365;

  const provider = createScriptProvider();
  anchor.setProvider(provider);

  const program = getKycRegistryProgram(provider);

  const configPda = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_registry_config")],
    program.programId
  )[0];

  const credentialPda = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc"), wallet.toBuffer()],
    program.programId
  )[0];

  // Ensure the kyc_registry config is initialized before issuing credentials.
  // This makes the `issue-kyc` command idempotent for devnet/demo.
  const configAlreadyExists = await (async () => {
    try {
      await (program.account as any).kycRegistryConfig.fetch(configPda);
      return true;
    } catch {
      return false;
    }
  })();

  if (!configAlreadyExists) {
    await program.methods
      .initialize()
      .accounts({
        config: configPda,
        admin: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  const sig = await program.methods
    .issueCredential(tier, expiryDays)
    .accounts({
      config: configPda,
      admin: provider.wallet.publicKey,
      wallet,
      credential: credentialPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  // eslint-disable-next-line no-console
  console.log(sig);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

