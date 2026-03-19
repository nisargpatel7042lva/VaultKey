"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  SolongWalletAdapter,
  TokenPocketWalletAdapter,
  LedgerWalletAdapter,
  TorusWalletAdapter,
  TrustWalletAdapter,
  SafePalWalletAdapter,
  CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";

function WalletSelector() {
  const {
    publicKey,
    connected,
    connecting,
    connect,
    disconnect,
    select,
  } = useWallet();

  const [busy, setBusy] = useState(false);

  const options = useMemo(() => {
    const adapters = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new SolongWalletAdapter(),
      new TokenPocketWalletAdapter(),
      new LedgerWalletAdapter(),
      new TorusWalletAdapter(),
      new TrustWalletAdapter(),
      new SafePalWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ];
    return adapters.map((a) => ({ name: a.name, label: a.name }));
  }, []);

  const [selectedName, setSelectedName] = useState<string>(
    (options[0]?.name ?? "Phantom") as unknown as string,
  );

  useEffect(() => {
    if (!selectedName && options[0]?.name) {
      setSelectedName(options[0].name);
    }
  }, [options, selectedName]);

  const shortPk = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey
        .toBase58()
        .slice(-4)}`
    : null;

  const label = connected ? shortPk : "Connect wallet";

  const handleConnect = async () => {
    try {
      setBusy(true);
      select(selectedName as any);
      await connect();
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setBusy(true);
      await disconnect();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
        value={selectedName}
        onChange={(e) => setSelectedName(e.target.value as any)}
        disabled={connected || busy || connecting}
      >
        {options.map((o) => (
          <option key={o.name} value={o.name}>
            {o.label}
          </option>
        ))}
      </select>

      {connected ? (
        <button
          type="button"
          onClick={handleDisconnect}
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
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-60"
        >
          <span className="h-2 w-2 rounded-full bg-muted" />
          Connect
        </button>
      )}
    </div>
  );
}

export function WalletConnectButton() {
  return <WalletSelector />;
}

