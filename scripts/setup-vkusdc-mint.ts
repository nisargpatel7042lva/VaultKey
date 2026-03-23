import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, Transaction, TransactionInstruction, Connection } from "@solana/web3.js";
import fs from "fs";
import os from "os";
import path from "path";
import {
  createInitializeMint2Instruction,
  createInitializeTransferHookInstruction,
  createUpdateTransferHookInstruction,
  ExtensionType,
  getMinimumBalanceForRentExemptMintWithExtensions,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  getExtraAccountMetaAddress,
  getMint,
  getTransferHook,
} from "@solana/spl-token";
import crypto from "crypto";
import { loadEnvLocal } from "./anchor-provider";

function isPlaceholder(v: string | undefined) {
  const s = (v ?? "").trim();
  // Common placeholder patterns used during development.
  return (
    !s ||
    s.startsWith("<") ||
    s.includes("pubkey") ||
    s.toUpperCase().startsWith("PUT_") ||
    s.toUpperCase() === "PUT" ||
    s.toUpperCase().includes("PUT_")
  );
}

function mustPubkey(name: string, v: string | undefined): PublicKey {
  if (isPlaceholder(v)) {
    throw new Error(`Missing/placeholder ${name}. Set it to a real base58 pubkey in .env.local`);
  }
  try {
    return new PublicKey(v!);
  } catch (e) {
    throw new Error(`Invalid pubkey for ${name}: "${String(v)}"`);
  }
}

function discriminator(name: string): Buffer {
  // Anchor: discriminator = sha256("global:<name>")[0..8]
  return crypto
    .createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

async function main() {
  // Ensure ts-node scripts read project env vars like Next.js does.
  loadEnvLocal();

  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  // Use the local Solana keypair (same one used by `anchor deploy`).
  const keypairPath =
    process.env.ANCHOR_WALLET_PATH ??
    path.join(os.homedir(), ".config", "solana", "id.json");
  if (!fs.existsSync(keypairPath)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[setup-vkusdc-mint] Missing keypair at ${keypairPath}. Skipping setup.`,
    );
    return;
  }
  const keypairJson = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const secretKey = Array.isArray(keypairJson)
    ? Uint8Array.from(keypairJson)
    : Uint8Array.from(keypairJson.secretKey);
  const adminKeypair = Keypair.fromSecretKey(secretKey);
  const admin = adminKeypair.publicKey;

  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Vercel/CI safety:
  // Judges should be able to deploy/view the UI even if program IDs are
  // still placeholders. If required env vars are missing, we exit cleanly.
  const transferHookProgramIdEnv = process.env.NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID;
  const kycRegistryProgramIdEnv = process.env.NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID;
  const transferHookIsPlaceholder = isPlaceholder(transferHookProgramIdEnv);
  const kycRegistryIsPlaceholder = isPlaceholder(kycRegistryProgramIdEnv);

  if (transferHookIsPlaceholder || kycRegistryIsPlaceholder) {
    // eslint-disable-next-line no-console
    console.warn(
      "[setup-vkusdc-mint] Skipping because required program IDs are placeholders. " +
        `NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID=${String(transferHookProgramIdEnv)} ` +
        `NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID=${String(kycRegistryProgramIdEnv)}`,
    );
    return;
  }

  const transferHookProgramId = mustPubkey(
    "NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID",
    transferHookProgramIdEnv,
  );
  const kycRegistryProgramId = mustPubkey(
    "NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID",
    kycRegistryProgramIdEnv,
  );

  // If vkUSDC mint isn't set yet, we create a new Token-2022 mint.
  const vkUsdcMintEnv = process.env.NEXT_PUBLIC_VKUSDC_MINT;
  const createNewMint = isPlaceholder(vkUsdcMintEnv);
  const vkUsdcMintKeypair = createNewMint ? Keypair.generate() : null;
  const vkUsdcMint = createNewMint
    ? vkUsdcMintKeypair!.publicKey
    : new PublicKey(vkUsdcMintEnv!);

  const providerConnection = provider.connection;

  // Allocate the mint sized for the TransferHook extension.
  // Important: on devnet, `InitializeMint2` expects the mint to be
  // allocated using the same extension set that the Token-2022 program
  // is configured to initialize (TransferHook only).
  const mintExtensions = [ExtensionType.TransferHook];
  const mintLen = getMintLen(mintExtensions);
  const rentExempt =
    await getMinimumBalanceForRentExemptMintWithExtensions(
      connection,
      mintExtensions,
      "confirmed",
    );

  if (createNewMint) {
    const mintInfo = await providerConnection.getAccountInfo(vkUsdcMint, "confirmed");
    if (mintInfo) throw new Error(`vkUSDC mint already exists: ${vkUsdcMint.toBase58()}`);

    // Step A1: create mint account
    const createTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: admin,
        newAccountPubkey: vkUsdcMint,
        space: mintLen,
        lamports: rentExempt,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
    );

    await provider.sendAndConfirm(createTx, [vkUsdcMintKeypair!]);

    // Step A2: initialize transfer hook extension then mint2.
    //
    // On devnet, `InitializeMint2` fails with `InvalidAccountData` if the
    // mint is allocated for TransferHook but `InitializeTransferHook` hasn't
    // run yet, so we do the extension init first.
    const initTx = new Transaction().add(
      createInitializeTransferHookInstruction(
        vkUsdcMint,
        admin, // transfer hook authority
        transferHookProgramId,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    initTx.add(
      createInitializeMint2Instruction(
        vkUsdcMint,
        6,
        admin, // mint authority
        null, // freeze authority
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    await provider.sendAndConfirm(initTx, []);
  } else {
    // If mint is already set, we'll verify transfer hook extension below.
  }

  // Step A2: ensure transfer hook extension points to A2
  {
    const mintInfo = await getMint(
      providerConnection,
      vkUsdcMint,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    const transferHook = getTransferHook(mintInfo);
    const needsInit =
      !transferHook || !transferHook.programId.equals(transferHookProgramId);

    if (needsInit) {
      const txHook = new Transaction();
      if (!transferHook) {
        txHook.add(
          createInitializeTransferHookInstruction(
            vkUsdcMint,
            admin,
            transferHookProgramId,
            TOKEN_2022_PROGRAM_ID,
          ),
        );
      } else {
        // Update existing TransferHook extension.
        txHook.add(
          createUpdateTransferHookInstruction(
            vkUsdcMint,
            admin,
            transferHookProgramId,
            [],
            TOKEN_2022_PROGRAM_ID,
          ),
        );
      }
      await provider.sendAndConfirm(txHook, []);
    }
  }

  // Step B: init extra-account-metas PDA via our A2 program
  const extraAccountMetaListPda = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), vkUsdcMint.toBuffer()],
    transferHookProgramId,
  )[0];

  // Cross-check: spl-token uses the same derivation.
  const extraAccountMetaListPdaSpl = getExtraAccountMetaAddress(
    vkUsdcMint,
    transferHookProgramId,
  );

  if (!extraAccountMetaListPda.equals(extraAccountMetaListPdaSpl)) {
    throw new Error(
      `PDA mismatch: our PDA ${extraAccountMetaListPda.toBase58()} != spl-token PDA ${extraAccountMetaListPdaSpl.toBase58()}`,
    );
  }

  // Only initialize TLV if missing.
  const existing = await providerConnection.getAccountInfo(
    extraAccountMetaListPda,
    "confirmed",
  );
  if (!existing) {
    const ix = new TransactionInstruction({
      programId: transferHookProgramId,
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true }, // payer
        { pubkey: extraAccountMetaListPda, isSigner: false, isWritable: true }, // PDA to create
        { pubkey: vkUsdcMint, isSigner: false, isWritable: false }, // protected mint
        { pubkey: kycRegistryProgramId, isSigner: false, isWritable: false }, // used for resolving credential PDA
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator("initialize_extra_account_meta_list"),
    });

    const tx2 = new Transaction().add(ix);
    // `tx2` only needs the admin wallet signature (payer). `vkUsdcMintKeypair`
    // is not a signer in the instruction keys, so do not pass it as an
    // extra signer.
    await provider.sendAndConfirm(tx2, []);
  }

  console.log("vkUSDC_MINT=" + vkUsdcMint.toBase58());
  console.log("extra-account-metas=" + extraAccountMetaListPda.toBase58());
  console.log("transfer-hook-program=" + transferHookProgramId.toBase58());
  console.log("kyc-registry-program=" + kycRegistryProgramId.toBase58());
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

