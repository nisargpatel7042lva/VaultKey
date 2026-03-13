import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { expect } from "chai";

// Note: the generated IDL type isn't available yet in this scaffold-only repo,
// so we keep Program as `Program` without generic typing.

describe("kyc_registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.KycRegistry as Program;

  const admin = (provider.wallet as anchor.Wallet).payer;

  const configPda = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_registry_config")],
    program.programId
  )[0];

  it("initializes config", async () => {
    await program.methods
      .initialize()
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const config = await program.account.kycRegistryConfig.fetch(configPda);
    expect(config.admin.toBase58()).to.eq(admin.publicKey.toBase58());
  });

  it("issues a credential and prevents re-issuing", async () => {
    const wallet = Keypair.generate();

    const credentialPda = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), wallet.publicKey.toBuffer()],
      program.programId
    )[0];

    await program.methods
      .issueCredential(1, 30)
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        wallet: wallet.publicKey,
        credential: credentialPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const cred = await program.account.kycCredential.fetch(credentialPda);
    expect(cred.wallet.toBase58()).to.eq(wallet.publicKey.toBase58());
    expect(cred.tier).to.eq(1);
    expect(cred.amlCleared).to.eq(true);
    expect(cred.expiry.toNumber()).to.be.greaterThan(cred.issuedAt.toNumber());

    try {
      await program.methods
        .issueCredential(1, 30)
        .accounts({
          config: configPda,
          admin: admin.publicKey,
          wallet: wallet.publicKey,
          credential: credentialPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      expect.fail("Expected AlreadyIssued");
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      expect(msg).to.match(/AlreadyIssued|already issued/i);
    }
  });

  it("rejects non-admin issue/revoke", async () => {
    const nonAdmin = Keypair.generate();
    const wallet = Keypair.generate();

    // fund nonAdmin so it can pay fees if needed
    const sig = await provider.connection.requestAirdrop(
      nonAdmin.publicKey,
      1_000_000_000
    );
    await provider.connection.confirmTransaction(sig, "confirmed");

    const credentialPda = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), wallet.publicKey.toBuffer()],
      program.programId
    )[0];

    try {
      await program.methods
        .issueCredential(1, 1)
        .accounts({
          config: configPda,
          admin: nonAdmin.publicKey,
          wallet: wallet.publicKey,
          credential: credentialPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([nonAdmin])
        .rpc();
      expect.fail("Expected NotAdmin");
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      expect(msg).to.match(/NotAdmin|not the admin/i);
    }

    // revoke should also fail (even if credential doesn't exist, NotAdmin is checked first)
    try {
      await program.methods
        .revokeCredential()
        .accounts({
          config: configPda,
          admin: nonAdmin.publicKey,
          wallet: wallet.publicKey,
          credential: credentialPda,
        })
        .signers([nonAdmin])
        .rpc();
      expect.fail("Expected NotAdmin");
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      expect(msg).to.match(/NotAdmin|not the admin/i);
    }
  });

  it("revokes a credential by setting aml_cleared=false", async () => {
    const wallet = Keypair.generate();
    const credentialPda = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), wallet.publicKey.toBuffer()],
      program.programId
    )[0];

    await program.methods
      .issueCredential(2, 7)
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        wallet: wallet.publicKey,
        credential: credentialPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    await program.methods
      .revokeCredential()
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        wallet: wallet.publicKey,
        credential: credentialPda,
      })
      .signers([admin])
      .rpc();

    const cred = await program.account.kycCredential.fetch(credentialPda);
    expect(cred.amlCleared).to.eq(false);
  });
});

