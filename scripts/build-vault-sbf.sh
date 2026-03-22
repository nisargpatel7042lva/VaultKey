#!/usr/bin/env bash
# Build `target/deploy/vault.so` using Docker (recommended on WSL when `anchor build`
# hits E0152 duplicate `core`). Requires Docker.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p target/deploy

echo "==> docker build -f Dockerfile.vault-sbf …"
docker build -f Dockerfile.vault-sbf -t vaultkey-vault-sbf .

cid="$(docker create vaultkey-vault-sbf)"
docker cp "${cid}:/out/vault.so" target/deploy/vault.so
docker rm "${cid}" >/dev/null

ls -la target/deploy/vault.so
echo "==> OK: target/deploy/vault.so"
