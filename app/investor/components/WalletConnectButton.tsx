"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";

function InnerButton() {
  const {
    publicKey,
    connected,
    connecting,
    disconnecting,
    wallet,
    connect,
    disconnect,
    select,
  } = useWallet();
  const [busy, setBusy] = useState(false);

  const [connectAfterSelect, setConnectAfterSelect] = useState(false);

  const label = connected
    ? `${publicKey?.toBase58().slice(0, 4)}…${publicKey
        ?.toBase58()
        .slice(-4)}`
    : "Connect Phantom";

  const handleClick = async () => {
    setBusy(true);

    if (connected) {
      try {
        await disconnect();
      } catch (e) {
        console.error(e);
      } finally {
        setBusy(false);
      }
      return;
    }

    // `connect()` throws `WalletNotSelectedError` until a wallet is selected
    // in the WalletProvider context.
    if (!wallet) {
      setConnectAfterSelect(true);
      select(PhantomWalletName);
      return;
    }

    try {
      await connect();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!connectAfterSelect) return;
    if (!wallet) return;
    if (connected || connecting || disconnecting) return;

    (async () => {
      try {
        await connect();
      } catch (e) {
        console.error(e);
      } finally {
        setConnectAfterSelect(false);
        setBusy(false);
      }
    })();
  }, [connectAfterSelect, wallet, connected, connecting, disconnecting, connect]);

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
  return <InnerButton />;
}

