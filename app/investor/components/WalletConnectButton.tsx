"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { RPC_URL } from "../../lib/anchor";

function InnerButton() {
  const { publicKey, connected, connecting, connect, disconnect } = useWallet();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!connecting) setBusy(false);
  }, [connecting]);

  const label = connected
    ? `${publicKey?.toBase58().slice(0, 4)}…${publicKey
        ?.toBase58()
        .slice(-4)}`
    : "Connect Phantom";

  const handleClick = async () => {
    try {
      setBusy(true);
      if (connected) {
        await disconnect();
      } else {
        await connect();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-60"
    >
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? "bg-success" : "bg-muted"
        }`}
      />
      {label}
    </button>
  );
}

export function WalletConnectButton() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <InnerButton />
      </WalletProvider>
    </ConnectionProvider>
  );
}

