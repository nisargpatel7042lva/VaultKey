export type RiskTier = "LOW" | "MEDIUM" | "HIGH";

// Mock-only per project bible.
export function scoreRisk(amountUsdc: number): RiskTier {
  // `amountUsdc` comes from on-chain events and is in base units (6 decimals).
  // 1000 USDC = 1_000_000_000 lamports, 10000 USDC = 10_000_000_000.
  if (amountUsdc < 1_000_000_000) return "LOW";
  if (amountUsdc < 10_000_000_000) return "MEDIUM";
  return "HIGH";
}

