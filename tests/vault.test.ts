import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

// Bucket B: vault tests.
// NOTE: These tests are marked `skip` for now because running them end-to-end
// requires a fully working Token-2022 mint + token account harness. The
// structure and assertions are provided so that wiring can be finished later
// without changing program interfaces.

describe.skip("vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const vault = anchor.workspace.Vault as Program;
  const kycRegistry = anchor.workspace.KycRegistry as Program;

  const admin = (provider.wallet as anchor.Wallet).payer;

  const vaultStatePda = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    vault.programId
  )[0];

  const kycConfigPda = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_registry_config")],
    kycRegistry.programId
  )[0];

  it("initializes the vault", async () => {
    const dummyVkMint = Keypair.generate().publicKey;
    const dummyUsdcVault = Keypair.generate().publicKey;

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

    const state = await (vault.account as any).vaultState.fetch(vaultStatePda);
    expect(state.admin.toBase58()).to.eq(admin.publicKey.toBase58());
    expect(state.vaspDid).to.eq("did:web:vaultkey.finance");
  });

  it("would deposit USDC and emit KYT event", async () => {
    // TODO: Once Token-2022 USDC + vkUSDC mints and token accounts are
    // created in tests, wire:
    // - issue KYC credential via kyc_registry
    // - call vault.depositUsdc and assert:
    //   - total_assets / total_shares updated
    //   - investor vkUSDC balance increased
    //   - a KytEvent is emitted with LOW/MEDIUM/HIGH tier as expected.
  });

  it("would withdraw USDC, emit KYT, and trigger Travel Rule when above threshold", async () => {
    // TODO: Once token accounts & balances are wired:
    // - perform a large deposit
    // - withdraw > 3_000 USDC
    // - assert a TravelRuleEvent is emitted with sender wallet, VASP DID, and amount.
  });
});

