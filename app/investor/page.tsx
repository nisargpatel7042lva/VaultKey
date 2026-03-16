"use client";

import { useMemo } from "react";
import { Connection } from "@solana/web3.js";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { useWallet, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { KycStatusBadge } from "./components/KycStatusBadge";
import { CLUSTER, RPC_URL } from "../lib/anchor";

function InvestorInner() {
  const wallet = useWallet();

  const program = useMemo(() => {
    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(connection, wallet as any, {
      preflightCommitment: "confirmed",
    });
    // For now we keep Program typed as any IDL; tests will provide concrete types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Program({} as Idl, "11111111111111111111111111111111", provider) as Program<Idl>;
  }, [wallet]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Investor</h1>
          <p className="text-sm text-muted">
            Connected to {CLUSTER} – KYC-gated vkUSDC vault.
          </p>
        </div>
        <KycStatusBadge program={program} />
      </header>
      {/* Deposit/Withdraw forms and stats will be added here in the next step */}
      <div className="text-sm text-muted">
        Deposit and withdrawal flows will appear here once the on-chain IDLs and
        program IDs are wired.
      </div>
    </div>
  );
}

export default function InvestorPage() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <WalletProvider wallets={wallets} autoConnect={false}>
      <InvestorInner />
    </WalletProvider>
  );
}

