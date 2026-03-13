import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

async function main() {
  const [walletStr, tierStr, daysStr] = process.argv.slice(2);
  if (!walletStr || !tierStr) {
    throw new Error("Usage: pnpm issue-kyc <wallet> <tier> [expiry_days]");
  }

  const wallet = new PublicKey(walletStr);
  const tier = Number(tierStr);
  const expiryDays = daysStr ? Number(daysStr) : 365;

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.KycRegistry as anchor.Program;

  const configPda = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_registry_config")],
    program.programId
  )[0];

  const credentialPda = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc"), wallet.toBuffer()],
    program.programId
  )[0];

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

