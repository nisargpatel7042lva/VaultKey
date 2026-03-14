#!/usr/bin/env bash
set -euo pipefail

# Bucket B: simple deploy script for all Anchor programs in this workspace.
# Assumes Anchor.toml lists kyc_registry and transfer_hook (and later vault).

anchor build
anchor deploy

