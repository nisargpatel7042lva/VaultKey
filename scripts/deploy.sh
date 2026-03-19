#!/usr/bin/env bash
set -u

# Bucket B/C: deploy helper.
# On hosted CI platforms (like Vercel), Anchor toolchain/build may fail.
# We treat on-chain deployment as "best effort" so the website build
# can still succeed and judges can view the project.

echo "[deploy.sh] Running `anchor build` (best effort)..."
if ! anchor build; then
  echo "[deploy.sh] WARNING: `anchor build` failed; skipping on-chain deploy."
  exit 0
fi

echo "[deploy.sh] Running `anchor deploy` (best effort)..."
if ! anchor deploy; then
  echo "[deploy.sh] WARNING: `anchor deploy` failed; website can still be deployed."
  exit 0
fi

echo "[deploy.sh] On-chain deploy completed."

