import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { EventParser, Idl, BorshCoder } from "@coral-xyz/anchor";
import { scoreRisk } from "./kyt-scorer";
import crypto from "crypto";

export interface KytEventMsg {
  wallet: string;
  amountUsdc: number;
  direction: 0 | 1;
  riskTier: "LOW" | "MEDIUM" | "HIGH";
  timestamp: number;
  signature?: string;
}

export interface TravelRuleEventMsg {
  senderWallet: string;
  senderVasp: string;
  amountUsdc: number;
  timestamp: number;
  txRef: string;
  signature?: string;
}

export type ListenerMessage =
  | { type: "kyt"; data: KytEventMsg }
  | { type: "travel_rule"; data: TravelRuleEventMsg };

function anchorEventDiscriminator(name: string): Buffer {
  // Anchor: discriminator = sha256("event:<name>")[0..8]
  const hash = crypto.createHash("sha256").update(`event:${name}`).digest();
  return hash.subarray(0, 8);
}

function readU64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

function readI64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}

function readPubkey(buf: Buffer, offset: number): string {
  return new PublicKey(buf.subarray(offset, offset + 32)).toBase58();
}

function readBorshString(
  buf: Buffer,
  offset: number,
): { value: string; next: number } {
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  return { value: buf.subarray(start, end).toString("utf8"), next: end };
}

const KYT_DISC = anchorEventDiscriminator("KytEvent");
const TR_DISC = anchorEventDiscriminator("TravelRuleEvent");

function decodeVaultEventFromProgramData(
  programDataB64: string,
): ListenerMessage | null {
  let raw: Buffer;
  try {
    raw = Buffer.from(programDataB64, "base64");
  } catch {
    return null;
  }
  if (raw.length < 8) return null;
  const disc = raw.subarray(0, 8);

  // Layouts mirror `programs/vault/src/events.rs`.
  if (disc.equals(KYT_DISC)) {
    // KytEvent:
    // 8   discriminator
    // 32  wallet Pubkey
    // 8   amount_usdc u64
    // 1   direction u8
    // 1   risk_tier u8 (0/1/2)
    // 8   timestamp i64
    if (raw.length < 8 + 32 + 8 + 1 + 1 + 8) return null;
    const wallet = readPubkey(raw, 8);
    const amountUsdc = Number(readU64LE(raw, 8 + 32));
    const direction = Number(raw.readUInt8(8 + 32 + 8)) as 0 | 1;
    const onchainRiskTier = Number(raw.readUInt8(8 + 32 + 8 + 1));
    const timestamp = Number(readI64LE(raw, 8 + 32 + 8 + 1 + 1));

    // Prefer the mocked scorer to match the project bible's backend behavior,
    // but keep on-chain tier as a fallback.
    const scored = scoreRisk(amountUsdc);
    const riskTier =
      scored ??
      (onchainRiskTier === 0
        ? "LOW"
        : onchainRiskTier === 1
          ? "MEDIUM"
          : "HIGH");

    return {
      type: "kyt",
      data: {
        wallet,
        amountUsdc,
        direction,
        riskTier,
        timestamp,
      },
    };
  }

  if (disc.equals(TR_DISC)) {
    // TravelRuleEvent:
    // 8    discriminator
    // 32   sender_wallet Pubkey
    // str  sender_vasp (borsh string)
    // 8    amount_usdc u64
    // 8    timestamp i64
    // str  tx_ref (borsh string)
    let cursor = 8;
    if (raw.length < cursor + 32) return null;
    const senderWallet = readPubkey(raw, cursor);
    cursor += 32;

    const senderVaspRes = readBorshString(raw, cursor);
    const senderVasp = senderVaspRes.value;
    cursor = senderVaspRes.next;

    if (raw.length < cursor + 8 + 8) return null;
    const amountUsdc = Number(readU64LE(raw, cursor));
    cursor += 8;
    const timestamp = Number(readI64LE(raw, cursor));
    cursor += 8;

    const txRefRes = readBorshString(raw, cursor);
    const txRef = txRefRes.value.slice(0, 8);

    return {
      type: "travel_rule",
      data: {
        senderWallet,
        senderVasp,
        amountUsdc,
        timestamp,
        txRef,
      },
    };
  }

  return null;
}

function loadVaultIdl(): Idl | null {
  // When `anchor build` succeeds, Anchor writes IDLs to target/idl/*.json.
  const idlPath = path.join(process.cwd(), "target", "idl", "vault.json");
  try {
    const raw = fs.readFileSync(idlPath, "utf-8");
    return JSON.parse(raw) as Idl;
  } catch {
    return null;
  }
}

export function startVaultLogListener(opts: {
  connection: Connection;
  vaultProgramId: PublicKey;
  onMessage: (msg: ListenerMessage) => void;
}) {
  const idl = loadVaultIdl();
  const coder = idl ? new BorshCoder(idl) : null;
  const parser = idl
    ? new EventParser(opts.vaultProgramId, coder!)
    : null;

  // eslint-disable-next-line no-console
  console.log(
    `[listener] subscribing to ${opts.vaultProgramId.toBase58()} (idl: ${
      idl ? "found" : "missing"
    })`,
  );

  return opts.connection.onLogs(
    opts.vaultProgramId,
    (logInfo) => {
      const { logs, signature } = logInfo;

      // Always attempt to decode from "Program data:" lines. This works without an IDL.
      for (const l of logs) {
        const prefix = "Program data: ";
        if (l.startsWith(prefix)) {
          const b64 = l.slice(prefix.length).trim();
          const decoded = decodeVaultEventFromProgramData(b64);
          if (decoded) {
            opts.onMessage({
              ...decoded,
              data: {
                ...(decoded.data as any),
                signature,
              },
            } as ListenerMessage);
          }
        }
      }

      if (parser) {
        try {
          const events = parser.parseLogs(logs, false) as unknown as Iterable<{
            name: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: any;
          }>;

          for (const evt of events) {
            if (evt.name === "KytEvent") {
              const wallet = (evt.data as any).wallet.toBase58();
              const amountUsdc = Number((evt.data as any).amountUsdc);
              const direction = Number((evt.data as any).direction) as 0 | 1;
              const timestamp = Number((evt.data as any).timestamp);
              opts.onMessage({
                type: "kyt",
                data: {
                  wallet,
                  amountUsdc,
                  direction,
                  riskTier: scoreRisk(amountUsdc),
                  timestamp,
                  signature,
                },
              });
            }
            if (evt.name === "TravelRuleEvent") {
              const senderWallet = (evt.data as any).senderWallet.toBase58();
              const senderVasp = String((evt.data as any).senderVasp);
              const amountUsdc = Number((evt.data as any).amountUsdc);
              const timestamp = Number((evt.data as any).timestamp);
              const txRef = String((evt.data as any).txRef ?? "").slice(0, 8);
              opts.onMessage({
                type: "travel_rule",
                data: {
                  senderWallet,
                  senderVasp,
                  amountUsdc,
                  timestamp,
                  txRef,
                  signature,
                },
              });
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[listener] failed to parse logs", e);
        }
      } else {
        // No-IDL mode relies on Program data event decoding above.
      }
    },
    "confirmed",
  );
}

if (require.main === module) {
  const rpc =
    process.env.NEXT_PUBLIC_RPC_URL ??
    process.env.RPC_URL ??
    "https://api.devnet.solana.com";
  const programId = new PublicKey(
    process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ??
      process.env.VAULT_PROGRAM_ID ??
      "11111111111111111111111111111111",
  );

  const connection = new Connection(rpc, "confirmed");
  startVaultLogListener({
    connection,
    vaultProgramId: programId,
    onMessage: (m) => {
      // eslint-disable-next-line no-console
      console.log("[listener]", JSON.stringify(m));
    },
  });
}

