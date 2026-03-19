export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">About VaultKey</h1>
        <p className="text-sm text-muted">
          A permissioned DeFi yield vault on Solana where compliance is enforced
          on-chain at the token transfer layer (not just in the frontend).
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-semibold">One-line pitch</h2>
        <p className="text-sm text-muted">
          VaultKey is an institutional vault where only KYC-verified wallets can
          deposit and receive vkUSDC shares, enforced by a Solana Token-2022
          transfer hook.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">How compliance works</h2>
        <div className="text-sm text-muted space-y-2">
          <p>
            <span className="font-medium text-white">1) `kyc_registry`</span>{" "}
            Admin issues a KYC credential PDA to a wallet. Revocation sets
            `aml_cleared = false` immediately.
          </p>
          <p>
            <span className="font-medium text-white">2) `transfer_hook` (Token-2022)</span>{" "}
            Every vkUSDC transfer is screened inside the Solana runtime.
            Transfers fail unless the recipient provides an existing, unexpired,
            AML-cleared credential PDA.
          </p>
          <p>
            <span className="font-medium text-white">3) `vault`</span>{" "}
            Deposits mint vkUSDC shares and emit KYT events; withdrawals burn
            shares and emit Travel Rule events for withdrawals above the demo
            threshold.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">MVP demo moments</h2>
        <div className="text-sm text-muted space-y-2">
          <p>
            <span className="font-medium text-white">Scene 1 — The block</span>
            : try sending vkUSDC shares to a non-KYC wallet. The transaction
            fails on-chain.
          </p>
          <p>
            <span className="font-medium text-white">Scene 2 — Deposit flow</span>
            : a verified investor deposits USDC, receives vkUSDC shares, and a
            KYT event appears in real time.
          </p>
          <p>
            <span className="font-medium text-white">Scene 3 — Travel Rule trigger</span>
            : withdraw a large amount; the backend forwards Travel Rule data to
            a mock VASP endpoint and ACKs it.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Devnet notes</h2>
        <p className="text-sm text-muted">
          This app is configured for devnet via <span className="font-mono">.env.local</span>.
          Make sure the program IDs (KYC registry, transfer hook, vault) are set
          correctly before running deposits/withdrawals.
        </p>
      </section>
    </div>
  );
}

