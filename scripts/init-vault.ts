/**
 * One-time devnet setup: create vault USDC ATA (owner = vault_state PDA),
 * initialize VaultState, transfer vkUSDC mint authority to vault PDA (required for deposit_usdc).
 *
 * Run: pnpm init-vault
 * Requires: .env.local with NEXT_PUBLIC_VAULT_PROGRAM_ID, NEXT_PUBLIC_VKUSDC_MINT, NEXT_PUBLIC_USDC_MINT (optional),
 * and ANCHOR_WALLET / ~/.config/solana/id.json = same admin that created vkUSDC mint.
 */
import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { createScriptProvider } from "./anchor-provider";
import { getVaultProgram } from "./vault-program";

const DEFAULT_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const DEFAULT_VASP_DID = "did:web:vaultkey.devnet";

async function main() {
  const provider = createScriptProvider();
  anchor.setProvider(provider);

  const admin = provider.wallet.publicKey;
  const connection = provider.connection;

  const vkMintStr = process.env.NEXT_PUBLIC_VKUSDC_MINT?.trim();
  if (!vkMintStr) {
    throw new Error("Set NEXT_PUBLIC_VKUSDC_MINT in .env.local");
  }
  const usdcMintStr =
    process.env.NEXT_PUBLIC_USDC_MINT?.trim() || DEFAULT_USDC;

  const vkUsdcMint = new PublicKey(vkMintStr);
  const usdcMint = new PublicKey(usdcMintStr);

  const program = getVaultProgram(provider);
  const vaultProgramId = program.programId;

  const [vaultStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    vaultProgramId,
  );

  const existingVault = await connection.getAccountInfo(vaultStatePda, "confirmed");
  if (existingVault) {
    // eslint-disable-next-line no-console
    console.log(
      `Vault already initialized at ${vaultStatePda.toBase58()}.`,
    );
    const vkMintInfoEarly = await getMint(
      connection,
      vkUsdcMint,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    if (vkMintInfoEarly.mintAuthority?.equals(vaultStatePda)) {
      return;
    }
    if (vkMintInfoEarly.mintAuthority?.equals(admin)) {
      const txAuth = new Transaction().add(
        createSetAuthorityInstruction(
          vkUsdcMint,
          admin,
          AuthorityType.MintTokens,
          vaultStatePda,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      );
      const sig = await provider.sendAndConfirm(txAuth, []);
      // eslint-disable-next-line no-console
      console.log("Transferred vkUSDC mint authority to vault PDA:", sig);
    }
    return;
  }

  const usdcVaultAta = getAssociatedTokenAddressSync(
    usdcMint,
    vaultStatePda,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const tx = new Transaction();

  const usdcAtaInfo = await connection.getAccountInfo(usdcVaultAta, "confirmed");
  if (!usdcAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        admin,
        usdcVaultAta,
        vaultStatePda,
        usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  const vaspDid = process.argv[2]?.trim() || DEFAULT_VASP_DID;

  const initIx = await program.methods
    .initializeVault(vaspDid)
    .accounts({
      vaultState: vaultStatePda,
      admin,
      vkUsdcMint,
      usdcVault: usdcVaultAta,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(initIx);

  const vkMintInfo = await getMint(
    connection,
    vkUsdcMint,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );

  if (vkMintInfo.mintAuthority && vkMintInfo.mintAuthority.equals(admin)) {
    tx.add(
      createSetAuthorityInstruction(
        vkUsdcMint,
        admin,
        AuthorityType.MintTokens,
        vaultStatePda,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );
  } else if (
    vkMintInfo.mintAuthority &&
    !vkMintInfo.mintAuthority.equals(vaultStatePda)
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      `vkUSDC mint authority is ${vkMintInfo.mintAuthority.toBase58()} (not admin). ` +
        `Deposits require mint authority = vault PDA ${vaultStatePda.toBase58()}. ` +
        `Transfer authority manually if deposits fail.`,
    );
  }

  const sig = await provider.sendAndConfirm(tx, []);
  // eslint-disable-next-line no-console
  console.log("init-vault tx:", sig);
  // eslint-disable-next-line no-console
  console.log("vault_state PDA:", vaultStatePda.toBase58());
  // eslint-disable-next-line no-console
  console.log("usdc_vault ATA:", usdcVaultAta.toBase58());
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
