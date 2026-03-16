export type RiskTier = "LOW" | "MEDIUM" | "HIGH";

// Mock-only per project bible.
export function scoreRisk(amountUsdc: number): RiskTier {
  if (amountUsdc < 1000) return "LOW";
  if (amountUsdc < 10000) return "MEDIUM";
  return "HIGH";
}

