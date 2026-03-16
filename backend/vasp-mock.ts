import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";

export interface TravelRulePayload {
  senderWallet: string;
  senderVasp: string;
  amountUsdc: number;
  timestamp: number;
  txRef: string;
}

export interface VaspAck {
  status: "ACK";
  ref: string;
}

export function createVaspMockServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const received: Array<TravelRulePayload & { ack: VaspAck; receivedAt: number }> =
    [];

  app.post("/travel-rule", (req, res) => {
    const payload = req.body as Partial<TravelRulePayload>;
    const ack: VaspAck = { status: "ACK", ref: randomUUID() };
    received.push({
      senderWallet: String(payload.senderWallet ?? ""),
      senderVasp: String(payload.senderVasp ?? ""),
      amountUsdc: Number(payload.amountUsdc ?? 0),
      timestamp: Number(payload.timestamp ?? Date.now()),
      txRef: String(payload.txRef ?? ""),
      ack,
      receivedAt: Date.now(),
    });
    res.json(ack);
  });

  app.get("/travel-rule", (_req, res) => {
    res.json(received);
  });

  return { app, received };
}

if (require.main === module) {
  const port = Number(process.env.VASP_MOCK_PORT ?? 3001);
  const { app } = createVaspMockServer();
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[vasp-mock] listening on http://localhost:${port}`);
  });
}

