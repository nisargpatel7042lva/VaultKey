import express from "express";
import cors from "cors";
import { Connection, PublicKey } from "@solana/web3.js";
import { createVaspMockServer, TravelRulePayload } from "./vasp-mock";
import { startVaultLogListener, ListenerMessage } from "./listener";

function toTxRef(sig: string | undefined) {
  return (sig ?? "").slice(0, 8);
}

async function main() {
  const vaspPort = Number(process.env.VASP_MOCK_PORT ?? 3001);
  const backendPort = Number(process.env.BACKEND_PORT ?? 3002);
  const rpc =
    process.env.NEXT_PUBLIC_RPC_URL ??
    process.env.RPC_URL ??
    "https://api.devnet.solana.com";
  const vaultProgramId = new PublicKey(
    process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ??
      process.env.VAULT_PROGRAM_ID ??
      "11111111111111111111111111111111",
  );

  // Start mock VASP server
  const { app: vaspApp, received } = createVaspMockServer();
  vaspApp.listen(vaspPort, () => {
    // eslint-disable-next-line no-console
    console.log(`[vasp-mock] listening on http://localhost:${vaspPort}`);
  });

  // SSE server for admin UI
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const clients = new Set<express.Response>();

  function broadcast(msg: ListenerMessage) {
    const payload = `data: ${JSON.stringify(msg)}\n\n`;
    for (const res of clients) {
      res.write(payload);
    }
  }

  app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: "hello" })}\n\n`);
    clients.add(res);
    req.on("close", () => {
      clients.delete(res);
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/travel-rule", (_req, res) => {
    res.json(received);
  });

  app.listen(backendPort, () => {
    // eslint-disable-next-line no-console
    console.log(`[backend] listening on http://localhost:${backendPort}`);
    // eslint-disable-next-line no-console
    console.log(`[backend] SSE: http://localhost:${backendPort}/events`);
  });

  // Start listener
  const connection = new Connection(rpc, "confirmed");
  startVaultLogListener({
    connection,
    vaultProgramId,
    onMessage: async (msg) => {
      broadcast(msg);

      if (msg.type === "travel_rule") {
        const payload: TravelRulePayload = {
          senderWallet: msg.data.senderWallet,
          senderVasp: msg.data.senderVasp,
          amountUsdc: msg.data.amountUsdc,
          timestamp: msg.data.timestamp,
          txRef: msg.data.txRef || toTxRef(msg.data.signature),
        };
        try {
          await fetch(`http://localhost:${vaspPort}/travel-rule`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[backend] failed to POST travel-rule", e);
        }
      }
    },
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

