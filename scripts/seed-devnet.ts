import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

/**
 * Bucket B: devnet seeding script.
 *
 * For now, this only:
 * - ensures the kyc_registry config is initialized
 * - ensures the transfer_hook config is initialized and pointed at kyc_registry
 *
 * Once the vault program (A3) is implemented, this script should be extended to:
 * - initialize the vault
 * - set up vkUSDC mint and USDC vault account
 * - issue a few demo KYC credentials
 * - optionally mock a first harvest_yield call.
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const kycRegistry = anchor.workspace.KycRegistry as anchor.Program;
  const transferHook = anchor.workspace.TransferHook as anchor.Program;

  const admin = provider.wallet.publicKey;

  const kycConfigPda = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_registry_config")],
    kycRegistry.programId
  )[0];

  const hookConfigPda = PublicKey.findProgramAddressSync(
    [Buffer.from("transfer_hook_config")],
    transferHook.programId
  )[0];

  // Initialize kyc_registry config if missing.
  try {
    await kycRegistry.account.kycRegistryConfig.fetch(kycConfigPda);
  } catch {
    await kycRegistry.methods
      .initialize()
      .accounts({
        config: kycConfigPda,
        admin,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // Initialize transfer_hook config if missing.
  try {
    await transferHook.account.transferHookConfig.fetch(hookConfigPda);
  } catch {
    await transferHook.methods
      .initializeExtraAccountMetaList(kycRegistry.programId)
      .accounts({
        config: hookConfigPda,
        admin,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

