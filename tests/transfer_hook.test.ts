import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

// Bucket B: KYC pass/fail tests for the transfer hook.

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

  const hookConfigPda = PublicKey.findProgramAddressSync(
    [Buffer.from("transfer_hook_config")],
    transferHook.programId
  )[0];

  it("initializes hook config pointing at kyc_registry", async () => {
    // Ensure kyc_registry config exists (idempotent-ish for localnet runs)
    try {
      await kycRegistry.account.kycRegistryConfig.fetch(kycConfigPda);
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

    await transferHook.methods
      .initializeExtraAccountMetaList(kycRegistry.programId)
      .accounts({
        config: hookConfigPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const cfg = await transferHook.account.transferHookConfig.fetch(
      hookConfigPda
    );
    expect(cfg.admin.toBase58()).to.eq(admin.publicKey.toBase58());
    expect(cfg.kycRegistryProgram.toBase58()).to.eq(
      kycRegistry.programId.toBase58()
    );
  });

  it("allows transfer when recipient has valid, AML-cleared credential", async () => {
    const recipient = Keypair.generate();

    const credentialPda = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), recipient.publicKey.toBuffer()],
      kycRegistry.programId
    )[0];

    // Issue credential
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

    // Call the hook directly, simulating Token-2022 invocation.
    await transferHook.methods
      .transferHook(new anchor.BN(1_000_000))
      .accounts({
        config: hookConfigPda,
        recipientWallet: recipient.publicKey,
        credential: credentialPda,
      })
      .rpc();
  });

  it("blocks transfer when recipient is not KYCed (PDA mismatch)", async () => {
    const kycWallet = Keypair.generate();
    const unkycedRecipient = Keypair.generate();

    const kycCredentialPda = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), kycWallet.publicKey.toBuffer()],
      kycRegistry.programId
    )[0];

    // Issue credential for kycWallet, but not for unkycedRecipient.
    await kycRegistry.methods
      .issueCredential(1, 30)
      .accounts({
        config: kycConfigPda,
        admin: admin.publicKey,
        wallet: kycWallet.publicKey,
        credential: kycCredentialPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // Pass the kycWallet credential while recipient_wallet is unkycedRecipient.
    try {
      await transferHook.methods
        .transferHook(new anchor.BN(1_000_000))
        .accounts({
          config: hookConfigPda,
          recipientWallet: unkycedRecipient.publicKey,
          credential: kycCredentialPda,
        })
        .rpc();
      expect.fail("Expected NotKyced error");
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      expect(msg).to.match(/NotKyced|not kyc/i);
    }
  });

  it("blocks transfer when wallet has been AML flagged", async () => {
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

    try {
      await transferHook.methods
        .transferHook(new anchor.BN(1_000_000))
        .accounts({
          config: hookConfigPda,
          recipientWallet: wallet.publicKey,
          credential: credentialPda,
        })
        .rpc();
      expect.fail("Expected AmlFlagged error");
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      expect(msg).to.match(/AmlFlagged|AML flagged/i);
    }
  });
});

