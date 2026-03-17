"use client";

const DEFAULT_BACKEND_URL = "http://localhost:3004";

export function getBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    DEFAULT_BACKEND_URL
  );
}

export type BackendEvent =
  | {
      type: "kyt";
      data: {
        wallet: string;
        amountUsdc: number;
        direction: 0 | 1;
        riskTier: "LOW" | "MEDIUM" | "HIGH";
        timestamp: number;
        signature?: string;
      };
    }
  | {
      type: "travel_rule";
      data: {
        senderWallet: string;
        senderVasp: string;
        amountUsdc: number;
        timestamp: number;
        txRef: string;
        signature?: string;
      };
    };

export function subscribeToBackendEvents(
  onEvent: (evt: BackendEvent) => void,
): () => void {
  const url = `${getBackendUrl()}/events`;
  const source = new EventSource(url);
  source.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data) as BackendEvent | { type: string };
      if (parsed && (parsed as any).type === "kyt") {
        onEvent(parsed as BackendEvent);
      }
      if (parsed && (parsed as any).type === "travel_rule") {
        onEvent(parsed as BackendEvent);
      }
    } catch {
      // ignore malformed
    }
  };
  source.onerror = () => {
    // let the browser handle reconnection; we keep UI silent
  };
  return () => {
    source.close();
  };
}

