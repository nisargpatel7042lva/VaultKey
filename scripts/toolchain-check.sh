#!/usr/bin/env bash
set -euo pipefail

echo "== VaultKey toolchain check =="
echo "node:   $(node -v)"
echo "pnpm:   $(pnpm -v)"
echo "rustc:  $(rustc --version)"
echo "anchor: $(anchor --version)"
echo "solana: $(solana --version)"

echo ""
echo "Solana active_release:"
readlink -f "${HOME}/.local/share/solana/install/active_release" || true

echo ""
echo "SBF cargo (Solana-bundled):"
SBF_CARGO="${HOME}/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/rust/bin/cargo"
if [[ -x "${SBF_CARGO}" ]]; then
  "${SBF_CARGO}" -V
else
  echo "Missing SBF cargo at: ${SBF_CARGO}"
  exit 1
fi

