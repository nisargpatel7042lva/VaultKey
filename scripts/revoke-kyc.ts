import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const [walletStr] = process.argv.slice(2);
  if (!walletStr) {
    throw new Error("Usage: pnpm revoke-kyc <wallet>");
  }

  const wallet = new PublicKey(walletStr);

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
    .revokeCredential()
    .accounts({
      config: configPda,
      admin: provider.wallet.publicKey,
      wallet,
      credential: credentialPda,
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

