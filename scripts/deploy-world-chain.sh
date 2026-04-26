#!/usr/bin/env bash
#
# Deploy CoalReceiptAnchor to World Chain.
#
# World-3. The contract is byte-identical to the 0G mainnet deploy — the
# DASigners precompile call inside _currentDAEpoch() is wrapped in a
# try/catch and returns 0 on chains without the precompile (e.g. World
# Chain). No Solidity edits needed.
#
# Usage:
#   WORLD_NETWORK=sepolia scripts/deploy-world-chain.sh
#   WORLD_NETWORK=mainnet scripts/deploy-world-chain.sh
#
# Env (pulled from backend/.env):
#   ALCHEMY_API_KEY              — for the default Alchemy RPC
#   ZERO_G_CHAIN_PRIVATE_KEY     — operator key (also used on 0G)
#
# Env (optional):
#   WORLD_CHAIN_RPC_URL          — overrides the default RPC (mainnet)
#   WORLD_CHAIN_SEPOLIA_RPC_URL  — overrides the default RPC (sepolia)
#
# After a successful deploy, the script prints the contract address and
# suggests the env var to set next. Nothing is written to .env
# automatically — you copy-paste to avoid clobbering other vars.
#
# Exits non-zero on any step failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT_DIR="$REPO_ROOT/contracts/0g-receipt-anchor"

# ─── Load backend env ────────────────────────────────────────────────────
if [ -f "$REPO_ROOT/backend/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/backend/.env"
  set +a
else
  echo "ERROR: $REPO_ROOT/backend/.env not found. Copy it from bernard-env-files first." >&2
  exit 1
fi

: "${ZERO_G_CHAIN_PRIVATE_KEY:?missing ZERO_G_CHAIN_PRIVATE_KEY}"
: "${ALCHEMY_API_KEY:?missing ALCHEMY_API_KEY}"

NETWORK="${WORLD_NETWORK:-sepolia}"

case "$NETWORK" in
  sepolia)
    CHAIN_ID=4801
    DEFAULT_RPC="https://worldchain-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
    RPC="${WORLD_CHAIN_SEPOLIA_RPC_URL:-$DEFAULT_RPC}"
    EXPLORER="https://sepolia.worldscan.org"
    ENV_VAR="WORLD_CHAIN_SEPOLIA_RECEIPT_ANCHOR_ADDRESS"
    ;;
  mainnet)
    CHAIN_ID=480
    DEFAULT_RPC="https://worldchain-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
    RPC="${WORLD_CHAIN_RPC_URL:-$DEFAULT_RPC}"
    EXPLORER="https://worldscan.org"
    ENV_VAR="WORLD_CHAIN_RECEIPT_ANCHOR_ADDRESS"
    ;;
  *)
    echo "ERROR: WORLD_NETWORK must be 'sepolia' or 'mainnet', got '$NETWORK'" >&2
    exit 1
    ;;
esac

echo "─── Deploy plan ─────────────────────────────────"
echo "  Network:       World Chain $NETWORK (chain $CHAIN_ID)"
echo "  Contract:      contracts/0g-receipt-anchor/src/CoalReceiptAnchor.sol"
echo "  RPC:           (redacted)"
echo "  Explorer:      $EXPLORER"
echo "  Operator key:  ZERO_G_CHAIN_PRIVATE_KEY"
echo "─────────────────────────────────────────────────"

# ─── Compile ─────────────────────────────────────────────────────────────
echo ""
echo "▶ forge build"
cd "$CONTRACT_DIR"
forge build

# ─── Preflight: operator balance ─────────────────────────────────────────
OP_ADDR=$(cast wallet address "$ZERO_G_CHAIN_PRIVATE_KEY")
BAL_WEI=$(cast balance "$OP_ADDR" --rpc-url "$RPC")
BAL_ETH=$(cast to-unit "$BAL_WEI" ether)
echo ""
echo "▶ Operator: $OP_ADDR"
echo "▶ Balance:  $BAL_ETH ETH on chain $CHAIN_ID"

if [ "$BAL_WEI" = "0" ]; then
  echo "ERROR: Operator has zero ETH on chain $CHAIN_ID. Fund it before deploying." >&2
  if [ "$NETWORK" = "sepolia" ]; then
    echo "  Try the Worldchain Sepolia bridge or a multi-chain Sepolia faucet." >&2
  fi
  exit 1
fi

# ─── Deploy ──────────────────────────────────────────────────────────────
echo ""
echo "▶ forge create (no constructor args)"
DEPLOY_OUTPUT=$(forge create \
  --rpc-url "$RPC" \
  --private-key "$ZERO_G_CHAIN_PRIVATE_KEY" \
  --broadcast \
  src/CoalReceiptAnchor.sol:CoalReceiptAnchor 2>&1)

echo "$DEPLOY_OUTPUT"

ADDR=$(echo "$DEPLOY_OUTPUT" | grep -Eio 'Deployed to: 0x[a-fA-F0-9]{40}' | awk '{print $3}' | head -n1)
TX=$(echo "$DEPLOY_OUTPUT"   | grep -Eio 'Transaction hash: 0x[a-fA-F0-9]{64}' | awk '{print $3}' | head -n1)

if [ -z "${ADDR:-}" ]; then
  echo "ERROR: could not parse deployed address from forge output." >&2
  exit 1
fi

echo ""
echo "─── Deployed ───────────────────────────────────"
echo "  Address:        $ADDR"
echo "  Tx:             ${TX:-(unknown)}"
echo "  Explorer addr:  $EXPLORER/address/$ADDR"
if [ -n "${TX:-}" ]; then
  echo "  Explorer tx:    $EXPLORER/tx/$TX"
fi
echo "───────────────────────────────────────────────"

# ─── Smoke test: dummy anchor call ───────────────────────────────────────
echo ""
echo "▶ Smoke-test: anchorReceipt(bytes32, bytes32, bytes32) with dummy hashes"
set +e
SMOKE_OUTPUT=$(cast send "$ADDR" \
  "anchorReceipt(bytes32,bytes32,bytes32)" \
  0x1111111111111111111111111111111111111111111111111111111111111111 \
  0x2222222222222222222222222222222222222222222222222222222222222222 \
  0x3333333333333333333333333333333333333333333333333333333333333333 \
  --rpc-url "$RPC" \
  --private-key "$ZERO_G_CHAIN_PRIVATE_KEY" 2>&1)
SMOKE_EC=$?
set -e
echo "$SMOKE_OUTPUT"
if [ "$SMOKE_EC" -ne 0 ]; then
  echo "WARNING: smoke test failed. Contract is deployed but anchorReceipt reverted/errored."
  echo "Check the explorer link above." >&2
else
  echo "▶ Smoke test sent. Verify a ReceiptAnchored event on the explorer."
fi

# ─── Next steps ──────────────────────────────────────────────────────────
echo ""
echo "─── Next steps ─────────────────────────────────"
echo "  1. Set in backend/.env:"
echo ""
echo "       $ENV_VAR=$ADDR"
echo ""
echo "  2. Restart backend (next dev), so the registry picks up the address."
echo "  3. If this was sepolia, deploy mainnet: WORLD_NETWORK=mainnet $0"
echo "  4. Run the anchor-receipts cron manually to retry any pending anchors:"
echo "       curl -X POST \$NEXT_PUBLIC_API_URL/api/cron/anchor-receipts \\"
echo "         -H \"authorization: Bearer \$CRON_SECRET\""
echo "───────────────────────────────────────────────"
