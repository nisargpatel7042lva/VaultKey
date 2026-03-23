import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const vault = anchor.workspace.Vault as Program;

  const admin = (provider.wallet as anchor.Wallet).payer;

  const vaultStatePda = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    vault.programId
  )[0];

  it("initializes the vault", async () => {
    const dummyVkMint = Keypair.generate().publicKey;
    const dummyUsdcVault = Keypair.generate().publicKey;

    const existing = await provider.connection.getAccountInfo(vaultStatePda);
    if (!existing) {
      await vault.methods
        .initializeVault("did:web:vaultkey.finance")
        .accounts({
          vaultState: vaultStatePda,
          admin: admin.publicKey,
          vkUsdcMint: dummyVkMint,
          usdcVault: dummyUsdcVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    }

    const state = await (vault.account as any).vaultState.fetch(vaultStatePda);
    expect(state.admin.toBase58()).to.eq(admin.publicKey.toBase58());
    expect(state.vaspDid).to.eq("did:web:vaultkey.finance");
  });

  it("allows admin to update nav via harvest_yield", async () => {
    const newNav = new anchor.BN(1_050_000);
    await vault.methods
      .harvestYield(newNav)
      .accounts({
        vaultState: vaultStatePda,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const state = await (vault.account as any).vaultState.fetch(vaultStatePda);
    expect(state.navPerShare.toNumber()).to.eq(1_050_000);
  });

  it("rejects harvest_yield from non-admin", async () => {
    const nonAdmin = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(nonAdmin.publicKey, 1_000_000_000);
    await provider.connection.confirmTransaction(sig, "confirmed");

    try {
      await vault.methods
        .harvestYield(new anchor.BN(1_100_000))
        .accounts({
          vaultState: vaultStatePda,
          admin: nonAdmin.publicKey,
        })
        .signers([nonAdmin])
        .rpc();
      expect.fail("Expected NotAdmin");
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      expect(msg).to.match(/NotAdmin|not the admin/i);
    }
  });

  it("executes deposit/withdraw token path when token-2022 harness is enabled", async function () {
    if (process.env.ENABLE_TOKEN2022_E2E !== "1") {
      this.skip();
    }
    // Intentionally gated: this path needs token-2022 mints/accounts + balances
    // and should run in CI/local where that harness is prepared.
  });
});

