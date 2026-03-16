export interface MockKytEvent {
  wallet: string;
  amountUsdc: number;
  direction: "deposit" | "withdraw";
  riskTier: "LOW" | "MEDIUM" | "HIGH";
  timestamp: string;
}

export interface MockTravelRuleEvent {
  senderWallet: string;
  senderVasp: string;
  amountUsdc: number;
  timestamp: string;
  ackRef: string;
}

export interface MockWhitelistRow {
  wallet: string;
  tier: "retail" | "institutional";
  status: "VERIFIED" | "PENDING" | "BLOCKED" | "EXPIRED";
  issuedAt: string;
  expiry: string;
}

export function getMockWhitelist(): MockWhitelistRow[] {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return [
    {
      wallet: "AminaBankClient1111111111111111111111111111",
      tier: "institutional",
      status: "VERIFIED",
      issuedAt: fmt(new Date(now.getTime() - 5 * 24 * 3600_000)),
      expiry: fmt(new Date(now.getTime() + 360 * 24 * 3600_000)),
    },
    {
      wallet: "RetailClient22222222222222222222222222222",
      tier: "retail",
      status: "PENDING",
      issuedAt: fmt(now),
      expiry: fmt(new Date(now.getTime() + 90 * 24 * 3600_000)),
    },
    {
      wallet: "FlaggedClient333333333333333333333333333",
      tier: "retail",
      status: "BLOCKED",
      issuedAt: fmt(new Date(now.getTime() - 30 * 24 * 3600_000)),
      expiry: fmt(new Date(now.getTime() + 60 * 24 * 3600_000)),
    },
  ];
}

export function getMockKytFeed(): MockKytEvent[] {
  const now = new Date();
  const mk = (
    minsAgo: number,
    dir: "deposit" | "withdraw",
    amount: number,
    riskTier: "LOW" | "MEDIUM" | "HIGH",
  ): MockKytEvent => ({
    wallet: "DemoWallet".padEnd(32, "X"),
    amountUsdc: amount,
    direction: dir,
    riskTier,
    timestamp: new Date(now.getTime() - minsAgo * 60_000).toLocaleTimeString(),
  });
  return [
    mk(2, "deposit", 500, "LOW"),
    mk(7, "withdraw", 1500, "MEDIUM"),
    mk(15, "withdraw", 12_000, "HIGH"),
  ];
}

export function getMockTravelRuleLog(): MockTravelRuleEvent[] {
  const now = new Date();
  const mk = (minsAgo: number, amount: number): MockTravelRuleEvent => ({
    senderWallet: "TravelRuleClient".padEnd(32, "Y"),
    senderVasp: "did:web:vaultkey.finance",
    amountUsdc: amount,
    timestamp: new Date(now.getTime() - minsAgo * 60_000).toLocaleTimeString(),
    ackRef: `ACK-${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}`,
  });
  return [mk(3, 5000), mk(45, 8000)];
}

