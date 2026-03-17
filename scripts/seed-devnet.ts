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

  const vkUsdcMintStr =
    process.env.NEXT_PUBLIC_VKUSDC_MINT ?? process.env.VKUSDC_MINT ?? "";
  if (!vkUsdcMintStr) {
    throw new Error(
      "Missing VKUSDC mint. Set NEXT_PUBLIC_VKUSDC_MINT (or VKUSDC_MINT).",
    );
  }
  const vkUsdcMint = new PublicKey(vkUsdcMintStr);

  const kycConfigPda = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_registry_config")],
    kycRegistry.programId
  )[0];

  const extraAccountMetaListPda = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), vkUsdcMint.toBuffer()],
    transferHook.programId,
  )[0];

  // Initialize kyc_registry config if missing.
  try {
    await (kycRegistry.account as any).kycRegistryConfig.fetch(kycConfigPda);
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

  // Initialize transfer_hook validation account if missing.
  try {
    // Existence check: just fetch account info via RPC.
    const info = await provider.connection.getAccountInfo(extraAccountMetaListPda);
    if (!info) throw new Error("missing");
  } catch {
    await transferHook.methods
      .initializeExtraAccountMetaList()
      .accounts({
        payer: admin,
        extraAccountMetaList: extraAccountMetaListPda,
        mint: vkUsdcMint,
        kycRegistryProgram: kycRegistry.programId,
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

