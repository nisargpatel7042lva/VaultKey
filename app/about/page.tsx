export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">VaultKey User Guide</h1>
        <p className="text-sm text-muted">
          New here? Follow these steps in order to understand exactly how to use
          VaultKey as an investor and as an admin.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-semibold">What this app does</h2>
        <p className="text-sm text-muted">
          VaultKey is a permissioned yield vault on Solana. Only wallets with a
          valid KYC credential can interact with vkUSDC flows.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Step-by-step (first-time setup)</h2>
        <div className="rounded border border-border bg-surface/40 p-4 text-sm text-muted space-y-3">
          <p>
            <span className="font-medium text-white">Step 1: Open Investor page</span><br />
            Go to <span className="font-mono text-white">Investor</span> from the left menu.
            This is where users connect wallets and perform deposits/withdrawals.
          </p>
          <p>
            <span className="font-medium text-white">Step 2: Connect your wallet</span><br />
            Use the wallet selector and click <span className="font-mono text-white">Connect</span>.
            Any supported Solana wallet can be used.
          </p>
          <p>
            <span className="font-medium text-white">Step 3: Check KYC badge</span><br />
            The badge near the header shows your status:
            <span className="text-green-400"> VERIFIED</span>,
            <span className="text-red-400"> BLOCKED</span>, or
            <span className="text-gray-300"> EXPIRED</span>.
          </p>
          <p>
            <span className="font-medium text-white">Step 4: If not VERIFIED, ask admin to issue KYC</span><br />
            Admin must issue a KYC credential before you can use vault actions.
          </p>
          <p>
            <span className="font-medium text-white">Step 4b (admin / devnet): Initialize the vault</span><br />
            If you see &quot;VaultState not found&quot;, run{" "}
            <span className="font-mono text-white">pnpm init-vault</span> once with the
            deployer wallet (same keypair as vkUSDC mint setup). This creates on-chain
            state and points vkUSDC mint authority at the vault PDA.
          </p>
          <p>
            <span className="font-medium text-white">Step 5: Deposit USDC</span><br />
            Enter amount in the Deposit card and submit. This mints vault shares
            (vkUSDC) and generates compliance events.
          </p>
          <p>
            <span className="font-medium text-white">Step 6: Withdraw vkUSDC</span><br />
            Enter shares in the Withdraw card. For larger withdrawals, a Travel
            Rule notice appears before confirmation.
          </p>
          <p>
            <span className="font-medium text-white">Step 7: Review your activity</span><br />
            Check the transaction history table at the bottom of Investor page.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Admin flow (monitoring + compliance)</h2>
        <div className="rounded border border-border bg-surface/40 p-4 text-sm text-muted space-y-3">
          <p>
            <span className="font-medium text-white">Step 1: Open Admin page</span><br />
            Go to <span className="font-mono text-white">Admin</span> from sidebar.
          </p>
          <p>
            <span className="font-medium text-white">Step 2: Review vault metrics</span><br />
            Confirm TVL, investor count, and blocked transfer attempts.
          </p>
          <p>
            <span className="font-medium text-white">Step 3: Manage whitelist</span><br />
            Use KYC issuance/revocation actions to control who can participate.
          </p>
          <p>
            <span className="font-medium text-white">Step 4: Watch compliance feed</span><br />
            KYT events stream in real time with LOW/MEDIUM/HIGH risk badges.
          </p>
          <p>
            <span className="font-medium text-white">Step 5: Watch Travel Rule log</span><br />
            Confirm high-value withdrawals and VASP ACK references.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Important notes</h2>
        <ul className="list-disc pl-5 text-sm text-muted space-y-1">
          <li>VaultKey is currently configured for devnet, not mainnet.</li>
          <li>
            Program IDs and mint addresses in <span className="font-mono text-white">.env.local</span>{" "}
            must be real base58 values.
          </li>
          <li>
            If a wallet is not KYC-verified, vault operations and transfer-hook
            protected flows will be blocked.
          </li>
        </ul>
      </section>
    </div>
  );
}

