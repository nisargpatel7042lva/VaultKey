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

function isPlaceholder(v: string | undefined) {
  return !v || v.trim() === "" || v.startsWith("<") || v.includes("pubkey");
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
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  // Use the local Solana keypair (same one used by `anchor deploy`).
  const keypairPath =
    process.env.ANCHOR_WALLET_PATH ??
    path.join(os.homedir(), ".config", "solana", "id.json");
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

  const transferHookProgramId = mustPubkey(
    "NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID",
    process.env.NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID,
  );
  const kycRegistryProgramId = mustPubkey(
    "NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID",
    process.env.NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID,
  );

  // If vkUSDC mint isn't set yet, we create a new Token-2022 mint.
  const vkUsdcMintEnv = process.env.NEXT_PUBLIC_VKUSDC_MINT;
  const createNewMint = isPlaceholder(vkUsdcMintEnv);
  const vkUsdcMintKeypair = createNewMint ? Keypair.generate() : null;
  const vkUsdcMint = createNewMint
    ? vkUsdcMintKeypair!.publicKey
    : new PublicKey(vkUsdcMintEnv!);

  const providerConnection = provider.connection;

  // Token-2022 transfer hooks are typically used together with
  // `DefaultAccountState`; allocate the mint with both extensions so
  // `InitializeMint2` validates the account data layout correctly.
  const mintExtensions = [ExtensionType.TransferHook, ExtensionType.DefaultAccountState];
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

    // Step A2: initialize mint + transfer hook extension
    const initTx = new Transaction()
      .add(
        createInitializeMint2Instruction(
          vkUsdcMint,
          6,
          admin, // mint authority
          null, // freeze authority
          TOKEN_2022_PROGRAM_ID,
        ),
      )
      .add(
        createInitializeTransferHookInstruction(
          vkUsdcMint,
          admin, // transfer hook authority
          transferHookProgramId,
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
    await provider.sendAndConfirm(tx2, vkUsdcMintKeypair ? [vkUsdcMintKeypair] : []);
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

