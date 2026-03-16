import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { EventParser, Idl, BorshCoder } from "@coral-xyz/anchor";
import { scoreRisk } from "./kyt-scorer";

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

      if (parser) {
        try {
          parser.parseLogs(logs, (evt) => {
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
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[listener] failed to parse logs", e);
        }
      } else {
        // Mock fallback: emit a KYT-like message when we see a transfer-like log
        // so the admin UI can be wired immediately.
        if (logs.some((l) => l.includes("deposit_usdc") || l.includes("withdraw_usdc"))) {
          const direction: 0 | 1 = logs.some((l) => l.includes("withdraw")) ? 1 : 0;
          const amountUsdc = direction ? 5000 : 500;
          opts.onMessage({
            type: "kyt",
            data: {
              wallet: "unknown",
              amountUsdc,
              direction,
              riskTier: scoreRisk(amountUsdc),
              timestamp: Date.now(),
              signature,
            },
          });
        }
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

