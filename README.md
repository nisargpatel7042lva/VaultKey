<div align="center">

# VaultKey

### Permissioned DeFi Infrastructure for Regulated Institutions

**KYC · KYT · AML · Travel Rule — enforced at the token layer, not the frontend**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.30.x-blue)](https://anchor-lang.com)
[![StableHacks 2026](https://img.shields.io/badge/StableHacks-2026-green)](https://dorahacks.io)
[![Network](https://img.shields.io/badge/Network-Devnet-orange)](https://explorer.solana.com/?cluster=devnet)

[Live Demo](https://vaultkey.vercel.app) · [Demo Video](https://youtube.com/your-link) · [Architecture Docs](#architecture)

</div>

---

## The Problem

Every DeFi vault today enforces compliance at the application layer — KYC checks live in the frontend, AML screening happens in an API, and access control is managed by a centralised server.

**This means any technical user can bypass every compliance rule by calling the smart contract directly.**

No frontend. No API. No rules.

This single vulnerability has blocked every regulated institution — banks, asset managers, custodians — from deploying DeFi products for their clients. The yields are real. The technology works. But the compliance doesn't hold.

## The Solution

VaultKey moves compliance enforcement from the application layer to the **token layer**.

Using Solana Token Extensions' **transfer hook**, every transfer of vault shares triggers a compliance check that runs **inside the Solana runtime itself** — not in a website, not in an API, but in the chain. There is no path around it.

```
Traditional DeFi:   Frontend check → API gate → Smart contract
                                                        ↑
                                               bypass possible here

VaultKey:           Transfer Hook (inside Solana runtime) → Smart contract
                           ↑
                    impossible to bypass — enforced by the chain
```

---

## What VaultKey Does

VaultKey is a **permissioned yield vault on Solana** where:

- Only **KYC-verified wallets** can deposit or receive vault shares
- **AML flagged wallets** are blocked instantly across all transfers
- Every transaction emits an **on-chain KYT event** — an immutable, auditable compliance record
- Withdrawals above $3,000 automatically trigger **Travel Rule** reporting
- A **bank operator dashboard** gives compliance officers full visibility and control

---

## Architecture

VaultKey is built as three composable Anchor programs on Solana.

```
┌─────────────────────────────────────────────────────────┐
│                    CREDENTIAL LAYER                      │
│                                                         │
│   KYC Provider → kyc_registry program → KYC Credential │
│                  (Anchor program)         (PDA on-chain) │
└──────────────────────────┬──────────────────────────────┘
                           │ credential checked on every transfer
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    COMPLIANCE LAYER                      │
│                                                         │
│   transfer_hook program — runs inside Solana runtime    │
│   ✓ KYC credential exists?                              │
│   ✓ Credential not expired?                             │
│   ✓ AML cleared?                                        │
│   ✗ Any check fails → transaction reverts               │
└──────────────────────────┬──────────────────────────────┘
                           │ only verified transfers reach vault
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      VAULT LAYER                        │
│                                                         │
│   vault program                                         │
│   • deposit_usdc   → mint vkUSDC shares                 │
│   • withdraw_usdc  → burn shares, return USDC           │
│   • emit KytEvent  → on every deposit + withdraw        │
│   • emit TravelRuleEvent → on withdrawals > $3,000      │
└──────────────────────────┬──────────────────────────────┘
                           │ USDC routed to yield strategy
                           ▼
                    Yield Source (Kamino / RWA)
```

### Program Overview

| Program | Program ID | Purpose |
|---|---|---|
| `kyc_registry` | `[devnet ID]` | Issues and revokes KYC credential PDAs |
| `transfer_hook` | `[devnet ID]` | Enforces compliance on every vkUSDC transfer |
| `vault` | `[devnet ID]` | Deposit, withdraw, yield accrual, compliance events |

---

## Compliance Design

### KYC — Know Your Customer
When a bank verifies a client's identity, they call `issue_credential` on the `kyc_registry` program. This creates a **KYC Credential PDA** — a non-transferable on-chain record tied to the client's wallet.

```rust
pub struct KycCredential {
    pub wallet:      Pubkey,   // verified wallet
    pub tier:        u8,       // 1=retail-qualified, 2=institutional
    pub issued_at:   i64,      // unix timestamp
    pub expiry:      i64,      // unix timestamp
    pub aml_cleared: bool,     // false = AML flagged, all transfers blocked
    pub bump:        u8,
}
// PDA seeds: ["kyc", wallet.key()]
```

### KYT — Know Your Transaction
Every deposit and withdrawal emits a structured `KytEvent` on-chain. This creates an immutable, auditable record that regulators can verify independently — without trusting the operator's off-chain systems.

```rust
pub struct KytEvent {
    pub wallet:      Pubkey,
    pub amount_usdc: u64,
    pub direction:   u8,       // 0=deposit, 1=withdraw
    pub risk_tier:   u8,       // 0=LOW, 1=MEDIUM, 2=HIGH
    pub timestamp:   i64,
}
```

### AML — Anti-Money Laundering
The bank operator can call `revoke_credential` at any time to set `aml_cleared = false`. The transfer hook checks this flag on every transfer — meaning the flagged wallet is **immediately blocked from all vault share transfers**, with zero latency and no frontend bypass possible.

### Travel Rule
Withdrawals above $3,000 USDC automatically emit a `TravelRuleEvent` on-chain with structured VASP data. A backend listener picks this up and dispatches the data package to the receiving VASP endpoint — satisfying FATF Travel Rule requirements.

```rust
pub struct TravelRuleEvent {
    pub sender_wallet: Pubkey,
    pub sender_vasp:   String,  // "did:web:vaultkey.finance"
    pub amount_usdc:   u64,
    pub timestamp:     i64,
    pub tx_ref:        String,
}
```

### Why the Transfer Hook Is the Key Innovation

Every other compliant DeFi vault enforces KYC in the deposit function only. This means a user who already holds vault shares can transfer them to any wallet — including unverified ones — by bypassing the vault program entirely.

VaultKey's transfer hook is registered on the `vkUSDC` mint itself. This means **every transfer**, from **any source**, to **any destination**, is screened — not just deposits through the vault program. The compliance is at the token, not the instruction.

---

## Demo Walkthrough

### Scene 1 — The Block
An unverified wallet attempts to receive `vkUSDC` shares via direct transfer.

```
Transaction attempted: KYC wallet → non-KYC wallet (vkUSDC transfer)
Transfer hook fires: checks recipient KYC credential PDA
Result: NotKyced error — transaction reverted
```

The rejection comes from the Solana runtime. Not from the website. Not from an API.

### Scene 2 — Deposit Flow
A verified investor deposits USDC through the investor UI.

```
1. Investor connects wallet (Phantom)
2. KYC status badge: ✓ VERIFIED (reads credential PDA)
3. Deposits 500 USDC
4. Receives vkUSDC shares (1:1 at initial NAV)
5. Admin compliance feed: KYT event appears in real time (risk tier: LOW)
```

### Scene 3 — Travel Rule Trigger
A verified investor withdraws above the Travel Rule threshold.

```
1. Investor withdraws 5,000 USDC worth of shares
2. UI shows: "Travel Rule applies to this withdrawal"
3. vault program emits TravelRuleEvent on-chain
4. Backend listener picks up event, POSTs VASP data package
5. Admin Travel Rule log: event logged with VASP ACK status
```

---

## Project Structure

```
vaultkey/
├── programs/
│   ├── kyc_registry/src/lib.rs     # Credential issuance + revocation
│   ├── transfer_hook/src/lib.rs    # Token Extensions compliance hook
│   └── vault/src/
│       ├── lib.rs                  # Core vault instructions
│       ├── state.rs                # VaultState account
│       ├── events.rs               # KytEvent, TravelRuleEvent
│       └── errors.rs               # Compliance error codes
├── tests/
│   ├── kyc_registry.test.ts        # Credential issuance tests
│   ├── transfer_hook.test.ts       # Block / allow transfer tests
│   └── vault.test.ts               # Deposit, withdraw, Travel Rule tests
├── scripts/
│   ├── issue-kyc.ts                # Admin CLI: issue credential
│   ├── revoke-kyc.ts               # Admin CLI: revoke credential
│   └── seed-devnet.ts              # Demo state seeding
├── backend/
│   ├── listener.ts                 # Program event subscriber
│   ├── vasp-mock.ts                # Mock VASP Travel Rule endpoint
│   └── kyt-scorer.ts               # Mock KYT risk scoring
└── app/
    ├── investor/                   # Investor deposit/withdraw UI
    └── admin/                      # Bank operator compliance dashboard
```

---

## Getting Started

### Prerequisites

```bash
# Required versions
node >= 18
rust >= 1.75
anchor-cli == 0.30.x
solana-cli >= 1.18
pnpm >= 8
```

### Installation

```bash
git clone https://github.com/your-username/vaultkey
cd vaultkey
pnpm install
```

### Build Programs

```bash
anchor build
```

### Deploy to Devnet

```bash
# Airdrop SOL for deploy fees
solana airdrop 4 --url devnet

# Deploy all three programs
anchor deploy --provider.cluster devnet
```

Copy the program IDs from the deploy output into `.env.local`:

```bash
cp .env.example .env.local
# Edit .env.local with your deployed program IDs
```

### Setup vkUSDC Mint

```bash
pnpm exec ts-node -P tsconfig.tests.json scripts/setup-vkusdc-mint.ts
```

### Seed Demo Data

```bash
pnpm exec ts-node -P tsconfig.tests.json scripts/seed-devnet.ts
```

### Run Frontend

```bash
pnpm dev
# Investor UI: http://localhost:3000/investor
# Admin dashboard: http://localhost:3000/admin
```

### Run Backend (Event Listener + Mock VASP)

```bash
pnpm run backend
# Event listener: port 3002
# Mock VASP endpoint: http://localhost:3001/travel-rule
```

### Run Tests

```bash
anchor test
```

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_CLUSTER=devnet
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID=     # from anchor deploy
NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID=    # from anchor deploy
NEXT_PUBLIC_VAULT_PROGRAM_ID=            # from anchor deploy
NEXT_PUBLIC_VKUSDC_MINT=                 # from setup-vkusdc-mint
NEXT_PUBLIC_ADMIN_WALLET=                # your admin wallet pubkey
VASP_MOCK_PORT=3001
BACKEND_PORT=3002
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Solana (devnet) |
| Smart contracts | Rust, Anchor 0.30.x |
| Token standard | SPL Token Extensions (Token-2022) |
| Compliance hook | Solana Transfer Hook Interface |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Wallet | Phantom, @solana/wallet-adapter |
| Backend | Node.js, TypeScript, @solana/web3.js |
| Deploy | Vercel (frontend) |

---

## Hackathon Track

Built for **StableHacks 2026** — Institutional Permissioned DeFi Vaults track.

Organised by Tenity. Co-hosted by AMINA Bank and Solana Foundation.

**Mandatory compliance requirements covered:**

| Requirement | Implementation | Enforcement layer |
|---|---|---|
| KYC | KycCredential PDA issued by admin after off-chain verification | Token layer (transfer hook) |
| KYT | KytEvent emitted on-chain for every deposit and withdrawal | Program layer (vault) |
| AML | aml_cleared flag on credential, revocable instantly by admin | Token layer (transfer hook) |
| Travel Rule | TravelRuleEvent emitted on withdrawals > $3,000, VASP data dispatched | Program layer (vault) + backend |

---

## Roadmap

- [x] KYC credential PDA — issue, revoke, expiry
- [x] Transfer hook — runtime compliance enforcement
- [x] Vault deposit + vkUSDC share minting
- [x] Vault withdrawal + Travel Rule event
- [x] KYT event emission
- [x] Investor UI
- [x] Admin compliance dashboard
- [ ] Real Kamino/MarginFi yield integration
- [ ] Real Chainalysis/Elliptic KYT API
- [ ] Real Onfido/Sumsub KYC onboarding flow
- [ ] TRISA Travel Rule protocol integration
- [ ] Multi-asset support (USDT, EURC)
- [ ] Mainnet deployment
- [ ] Smart contract audit

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built for StableHacks 2026 · Powered by Solana · Made for institutions

</div>
