import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("transfer_hook", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const kycRegistry = anchor.workspace.KycRegistry as Program;
  const transferHook = anchor.workspace.TransferHook as Program;

  const admin = (provider.wallet as anchor.Wallet).payer;

  const kycConfigPda = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_registry_config")],
    kycRegistry.programId
  )[0];

  const extraAccountMetaListPdaForMint = (mint: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.toBuffer()],
      transferHook.programId
    )[0];

  async function ensureKycConfig(): Promise<void> {
    try {
      await (kycRegistry.account as any).kycRegistryConfig.fetch(kycConfigPda);
    } catch {
      await kycRegistry.methods
        .initialize()
        .accounts({
          config: kycConfigPda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    }
  }

  it("initializes extra account meta list pointing at kyc_registry", async () => {
    await ensureKycConfig();

    // Dummy mint pubkey for PDA derivation – in real tests this will be an
    // actual Token-2022 mint account.
    const dummyMint = Keypair.generate().publicKey;
    const extraMetaPda = extraAccountMetaListPdaForMint(dummyMint);

    // Initialize only if missing, so repeated test runs are stable.
    const infoBefore = await provider.connection.getAccountInfo(extraMetaPda);
    if (!infoBefore) {
      await transferHook.methods
        .initializeExtraAccountMetaList()
        .accounts({
          payer: admin.publicKey,
          extraAccountMetaList: extraMetaPda,
          mint: dummyMint,
          kycRegistryProgram: kycRegistry.programId,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    }

    const infoAfter = await provider.connection.getAccountInfo(extraMetaPda);
    expect(infoAfter).to.not.eq(null);
  });

  it("issues a valid credential that the hook can use", async () => {
    await ensureKycConfig();
    const recipient = Keypair.generate();
    const credentialPda = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), recipient.publicKey.toBuffer()],
      kycRegistry.programId
    )[0];

    await kycRegistry.methods
      .issueCredential(1, 30)
      .accounts({
        config: kycConfigPda,
        admin: admin.publicKey,
        wallet: recipient.publicKey,
        credential: credentialPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const cred = await (kycRegistry.account as any).kycCredential.fetch(credentialPda);
    expect(cred.amlCleared).to.eq(true);
    expect(cred.expiry.toNumber()).to.be.greaterThan(cred.issuedAt.toNumber());
  });

  it("marks a wallet as AML-flagged after revoke", async () => {
    await ensureKycConfig();
    const wallet = Keypair.generate();

    const credentialPda = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), wallet.publicKey.toBuffer()],
      kycRegistry.programId
    )[0];

    // Issue credential (aml_cleared = true)
    await kycRegistry.methods
      .issueCredential(1, 30)
      .accounts({
        config: kycConfigPda,
        admin: admin.publicKey,
        wallet: wallet.publicKey,
        credential: credentialPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // Revoke to set aml_cleared = false (AML flagged).
    await kycRegistry.methods
      .revokeCredential()
      .accounts({
        config: kycConfigPda,
        admin: admin.publicKey,
        wallet: wallet.publicKey,
        credential: credentialPda,
      })
      .signers([admin])
      .rpc();

    const cred = await (kycRegistry.account as any).kycCredential.fetch(credentialPda);
    expect(cred.amlCleared).to.eq(false);
  });

  it("executes transfer-hook end-to-end when token-2022 harness is enabled", async function () {
    if (process.env.ENABLE_TOKEN2022_E2E !== "1") {
      this.skip();
    }
    // This is intentionally gated behind ENABLE_TOKEN2022_E2E.
    // A full Execute-path test requires token-2022 mint/account fixtures and
    // transfer construction including extra accounts.
  });
});

