# VaultKey Backend — Run & Deploy Guide (Devnet Demo)

This guide explains how to run the **VaultKey backend stack** (listener + mock VASP) locally for the hackathon demo. It assumes you are on **WSL2 + Node + pnpm** and that the Anchor programs are (or will be) deployed to devnet.

---

## 1. Prerequisites

- **Node.js** 18+ (you already have 22.x)
- **pnpm** (already configured in this repo)
- **Solana CLI** installed and on `PATH`
- **Anchor CLI** 0.32.1 installed (via `avm`) — already done

Check:

```bash
node -v
pnpm -v
solana --version
anchor --version
```

---

## 2. Configure environment variables

Create `.env.local` at the project root (if it doesn’t exist yet) and set:

```bash
NEXT_PUBLIC_CLUSTER=devnet
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com

NEXT_PUBLIC_KYC_REGISTRY_PROGRAM_ID=<kyc_registry_program_id>
NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID=<transfer_hook_program_id>
NEXT_PUBLIC_VAULT_PROGRAM_ID=<vault_program_id>

NEXT_PUBLIC_VKUSDC_MINT=<vkUSDC_mint_pubkey>
NEXT_PUBLIC_ADMIN_WALLET=<your_admin_wallet_pubkey>

VASP_MOCK_PORT=3003
BACKEND_PORT=3004

NEXT_PUBLIC_BACKEND_URL=http://localhost:3004
```

You can fill the program IDs and mint after you deploy the Anchor programs to devnet.

### Vault: `Unable to open program file` (no `vault.so`)

`solana program deploy ... target/deploy/vault.so` only works **after** the binary exists. Build it first:

```bash
cd /path/to/VaultKey
anchor build -p vault
ls -la target/deploy/vault.so
```

Then deploy to **your** vault program id (must match `vault-keypair.json` and `declare_id!`):

```bash
solana program deploy target/deploy/vault.so \
  --program-id target/deploy/vault-keypair.json \
  -u devnet
```

If `anchor build -p vault` fails with **E0152 duplicate `core` / `sized`** (common on **WSL2** + **Agave 3.1.x**), use the **Docker** build (clean Linux, pinned Agave **3.0.10** inside the image):

```bash
pnpm run build:vault:sbf
```

That runs **`scripts/build-vault-sbf.sh`** → **`Dockerfile.vault-sbf`**. Details: **`docs/SBF_E0152.md`**. CI: workflow **“Build vault (SBF, Docker)”** uploads **`vault.so`** as an artifact.

---

## 3. Install dependencies

From the project root:

```bash
cd /home/mysterioxplorer/VaultKey
pnpm install --no-frozen-lockfile
```

This installs:
- Frontend (Next.js + Tailwind + wallet adapter)
- Anchor TypeScript client
- Backend deps (`express`, `cors`, `uuid`, etc.)

---

## 4. Start the backend (listener + mock VASP)

The backend entrypoint is `backend/index.ts`. It:
- Starts the **mock VASP** (`POST /travel-rule`, `GET /travel-rule`)
- Starts the **backend API** (`/health`, `/events` SSE, `/travel-rule` proxy)
- Subscribes to **vault program logs** and emits KYT + Travel Rule events

Run it (ports can be overridden via env):

```bash
cd /home/mysterioxplorer/VaultKey
VASP_MOCK_PORT=3003 BACKEND_PORT=3004 pnpm backend
```

You should see logs like:

```text
[listener] subscribing to <vault_program_id> (idl: missing or found)
[vasp-mock] listening on http://localhost:3003
[backend] listening on http://localhost:3004
[backend] SSE: http://localhost:3004/events
```

### Health checks

In another terminal:

```bash
curl http://localhost:3004/health
curl http://localhost:3004/events
curl http://localhost:3004/travel-rule
```

Expected:
- `/health` → `{"ok":true}`
- `/events` → an initial SSE line like `data: {"type":"hello"}`
- `/travel-rule` → `[]` until a Travel Rule event is triggered

---

## 5. Start the frontend

In a separate terminal:

```bash
cd /home/mysterioxplorer/VaultKey
pnpm dev
```

Next will start on `http://localhost:3000` or `http://localhost:3001` (if 3000 is in use).

Pages:
- Investor UI: `http://localhost:3001/investor`
- Admin dashboard: `http://localhost:3001/admin`

The admin dashboard will now:
- Stream **live KYT events** from `GET /events` (SSE)
- Fetch **Travel Rule ACKs** from `GET /travel-rule`
- Show **real KYC credentials** directly from the `kyc_registry` program

---

## 6. Triggering demo flows

Once programs are deployed and wired:

1. **Scene 1 — The block**
   - Use Phantom with a **non-KYC wallet**.
   - Attempt to transfer vkUSDC to it from a KYC wallet.
   - The transfer hook should fail; admin dashboard shows increased “Blocked transfer attempts”.

2. **Scene 2 — Deposit flow**
   - Connect a **KYC-verified wallet** on `/investor`.
   - Perform a `deposit_usdc` transaction (once wired).
   - `/admin` → Compliance feed shows a KYT event with risk tier from the backend.

3. **Scene 3 — Travel Rule trigger**
   - From `/investor`, perform a **withdrawal ≥ 5000 USDC**.
   - Backend emits a `TravelRuleEvent`, POSTs to `vasp-mock`.
   - `/admin` → Travel Rule log shows:
     - sender wallet
     - sender VASP DID
     - amount
     - ACK ref from mock VASP.

---

## 7. Stopping services

To stop the backend:

```bash
# In the terminal where backend is running
Ctrl + C
```

To confirm ports are free:

```bash
ss -ltnp | grep -E ':3003|:3004' || true
```

No output means the backend and mock VASP are stopped.

---

## 8. Notes & troubleshooting

- If you change backend code, restart:

```bash
VASP_MOCK_PORT=3003 BACKEND_PORT=3004 pnpm backend
```

- If `/events` doesn’t stream:
  - Confirm backend is running (check logs).
  - Confirm `NEXT_PUBLIC_BACKEND_URL` matches the backend port (default `http://localhost:3004`).

- If `/travel-rule` is always empty:
  - You may not have emitted any `TravelRuleEvent` on-chain yet (no large withdrawals).
  - For demo, you can temporarily inject a fake Travel Rule event from the backend or run a scripted withdrawal once vault wiring is complete.

