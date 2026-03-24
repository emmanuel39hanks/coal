#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_BRANCH="${DEV_BRANCH:-dev}"
VERCEL_TEAM_SLUG="${VERCEL_TEAM_SLUG:-emmanuel-haankwendas-projects}"
FRONTEND_BRANCH_URL="${FRONTEND_BRANCH_URL:-https://coal-git-${DEV_BRANCH}-${VERCEL_TEAM_SLUG}.vercel.app}"
BACKEND_BRANCH_URL="${BACKEND_BRANCH_URL:-https://coal-backend-git-${DEV_BRANCH}-${VERCEL_TEAM_SLUG}.vercel.app}"
FRONTEND_DIR="${ROOT_DIR}/frontend"
BACKEND_DIR="${ROOT_DIR}/backend"
BACKEND_ENV_FILE="${ROOT_DIR}/backend/.env"
FRONTEND_ENV_FILE="${ROOT_DIR}/frontend/.env"

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI is required." >&2
  exit 1
fi

if [[ ! -f "${BACKEND_ENV_FILE}" || ! -f "${FRONTEND_ENV_FILE}" ]]; then
  echo "Expected backend/.env and frontend/.env to exist before syncing preview envs." >&2
  exit 1
fi

if ! git ls-remote --exit-code --heads origin "${DEV_BRANCH}" >/dev/null 2>&1; then
  echo "Remote branch '${DEV_BRANCH}' does not exist yet. Push it before syncing Vercel preview envs." >&2
  exit 1
fi

read_env_value() {
  local file="$1"
  local key="$2"

  node -e '
const fs = require("fs");
const file = process.argv[1];
const key = process.argv[2];
const content = fs.readFileSync(file, "utf8");
for (const rawLine of content.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  const currentKey = line.slice(0, idx).trim();
  if (currentKey !== key) continue;
  let value = line.slice(idx + 1).trim();
  const hashIndex = value.indexOf(" #");
  if (hashIndex !== -1) value = value.slice(0, hashIndex).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("\x27") && value.endsWith("\x27"))) {
    value = value.slice(1, -1);
  }
  process.stdout.write(value);
  process.exit(0);
}
' "${file}" "${key}"
}

derive_dev_database_url() {
  local source_url="$1"
  DEV_DATABASE_URL_SOURCE="${source_url}" node <<'EOF'
const source = process.env.DEV_DATABASE_URL_SOURCE;
if (!source) process.exit(1);
const url = new URL(source);
url.searchParams.set('schema', 'dev');
process.stdout.write(url.toString());
EOF
}

upsert_branch_env() {
  local project_dir="$1"
  local key="$2"
  local value="$3"
  if [[ -z "${value}" ]]; then
    return
  fi
  vercel env add "${key}" preview "${DEV_BRANCH}" --force --yes --value "${value}" --cwd "${project_dir}" >/dev/null
}

BACKEND_DATABASE_URL="$(read_env_value "${BACKEND_ENV_FILE}" DATABASE_URL)"
BACKEND_ALCHEMY_API_KEY="$(read_env_value "${BACKEND_ENV_FILE}" ALCHEMY_API_KEY)"
BACKEND_PRIVY_APP_ID="$(read_env_value "${BACKEND_ENV_FILE}" PRIVY_APP_ID)"
BACKEND_PRIVY_APP_SECRET="$(read_env_value "${BACKEND_ENV_FILE}" PRIVY_APP_SECRET)"
BACKEND_CRON_SECRET="$(read_env_value "${BACKEND_ENV_FILE}" CRON_SECRET)"
BACKEND_UPLOADTHING_SECRET="$(read_env_value "${BACKEND_ENV_FILE}" UPLOADTHING_SECRET)"
BACKEND_UPLOADTHING_APP_ID="$(read_env_value "${BACKEND_ENV_FILE}" UPLOADTHING_APP_ID)"
BACKEND_UPLOADTHING_TOKEN="$(read_env_value "${BACKEND_ENV_FILE}" UPLOADTHING_TOKEN)"
BACKEND_RESEND_API_KEY="$(read_env_value "${BACKEND_ENV_FILE}" RESEND_API_KEY)"
BACKEND_UPSTASH_URL="$(read_env_value "${BACKEND_ENV_FILE}" UPSTASH_REDIS_REST_URL)"
BACKEND_UPSTASH_TOKEN="$(read_env_value "${BACKEND_ENV_FILE}" UPSTASH_REDIS_REST_TOKEN)"
BACKEND_OPERATOR_KEY="$(read_env_value "${BACKEND_ENV_FILE}" COMMERCE_PAYMENTS_OPERATOR_KEY)"
BACKEND_OPERATOR_FEE_BPS="$(read_env_value "${BACKEND_ENV_FILE}" COMMERCE_PAYMENTS_FEE_BPS)"
BACKEND_ZERO_G_ENABLED="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_ENABLED)"
BACKEND_ZERO_G_CHAIN_RPC_URL="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_CHAIN_RPC_URL)"
BACKEND_ZERO_G_CHAIN_ID="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_CHAIN_ID)"
BACKEND_ZERO_G_CHAIN_PRIVATE_KEY="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_CHAIN_PRIVATE_KEY)"
BACKEND_ZERO_G_RECEIPT_ANCHOR_ADDRESS="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_RECEIPT_ANCHOR_ADDRESS)"
BACKEND_ZERO_G_STORAGE_INDEXER_URL="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_STORAGE_INDEXER_URL)"
BACKEND_ZERO_G_STORAGE_KV_RPC_URL="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_STORAGE_KV_RPC_URL)"
BACKEND_ZERO_G_STORAGE_FLOW_ADDRESS="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_STORAGE_FLOW_ADDRESS)"
BACKEND_ZERO_G_STORAGE_STREAM_ID="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_STORAGE_STREAM_ID)"
BACKEND_ZERO_G_STORAGE_ENCRYPTION_KEY="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_STORAGE_ENCRYPTION_KEY)"
BACKEND_ZERO_G_STORAGE_TARGET_MBPS="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_STORAGE_TARGET_MBPS)"
BACKEND_ZERO_G_COMPUTE_ENABLED="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_COMPUTE_ENABLED)"
BACKEND_ZERO_G_COMPUTE_PROVIDER="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_COMPUTE_PROVIDER)"
BACKEND_ZERO_G_COMPUTE_BASE_URL="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_COMPUTE_BASE_URL)"
BACKEND_ZERO_G_COMPUTE_API_KEY="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_COMPUTE_API_KEY)"
BACKEND_ZERO_G_COMPUTE_MODEL="$(read_env_value "${BACKEND_ENV_FILE}" ZERO_G_COMPUTE_MODEL)"

FRONTEND_UPLOADTHING_SECRET="$(read_env_value "${FRONTEND_ENV_FILE}" UPLOADTHING_SECRET)"
FRONTEND_UPLOADTHING_APP_ID="$(read_env_value "${FRONTEND_ENV_FILE}" UPLOADTHING_APP_ID)"
FRONTEND_UPLOADTHING_TOKEN="$(read_env_value "${FRONTEND_ENV_FILE}" UPLOADTHING_TOKEN)"
FRONTEND_MOONPAY_API_KEY="$(read_env_value "${FRONTEND_ENV_FILE}" NEXT_PUBLIC_MOONPAY_API_KEY)"
FRONTEND_MOONPAY_ENV="$(read_env_value "${FRONTEND_ENV_FILE}" NEXT_PUBLIC_MOONPAY_ENV)"
FRONTEND_PRIVY_APP_ID="$(read_env_value "${FRONTEND_ENV_FILE}" NEXT_PUBLIC_PRIVY_APP_ID)"
FRONTEND_BUNDLER_KEY="$(read_env_value "${FRONTEND_ENV_FILE}" NEXT_PUBLIC_COINBASE_BUNDLER_KEY)"
FRONTEND_SETTLEMENT_TOKEN_ADDRESS="$(read_env_value "${FRONTEND_ENV_FILE}" NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS)"
FRONTEND_SETTLEMENT_TOKEN_DECIMALS="$(read_env_value "${FRONTEND_ENV_FILE}" NEXT_PUBLIC_SETTLEMENT_TOKEN_DECIMALS)"
FRONTEND_SETTLEMENT_TOKEN_SYMBOL="$(read_env_value "${FRONTEND_ENV_FILE}" NEXT_PUBLIC_SETTLEMENT_TOKEN_SYMBOL)"
FRONTEND_SETTLEMENT_TOKEN_NAME="$(read_env_value "${FRONTEND_ENV_FILE}" NEXT_PUBLIC_SETTLEMENT_TOKEN_NAME)"

DEV_DATABASE_URL="${DEV_DATABASE_URL:-$(derive_dev_database_url "${BACKEND_DATABASE_URL}")}"

upsert_branch_env "${BACKEND_DIR}" DATABASE_URL "${DEV_DATABASE_URL}"
upsert_branch_env "${BACKEND_DIR}" ALCHEMY_API_KEY "${BACKEND_ALCHEMY_API_KEY}"
upsert_branch_env "${BACKEND_DIR}" PRIVY_APP_ID "${BACKEND_PRIVY_APP_ID}"
upsert_branch_env "${BACKEND_DIR}" PRIVY_APP_SECRET "${BACKEND_PRIVY_APP_SECRET}"
upsert_branch_env "${BACKEND_DIR}" CRON_SECRET "${BACKEND_CRON_SECRET}"
upsert_branch_env "${BACKEND_DIR}" NEXT_PUBLIC_FRONTEND_URL "${FRONTEND_BRANCH_URL}"
upsert_branch_env "${BACKEND_DIR}" NEXT_PUBLIC_APP_URL "${BACKEND_BRANCH_URL}"
upsert_branch_env "${BACKEND_DIR}" NEXT_PUBLIC_API_URL "${BACKEND_BRANCH_URL}"
upsert_branch_env "${BACKEND_DIR}" UPLOADTHING_SECRET "${BACKEND_UPLOADTHING_SECRET}"
upsert_branch_env "${BACKEND_DIR}" UPLOADTHING_APP_ID "${BACKEND_UPLOADTHING_APP_ID}"
upsert_branch_env "${BACKEND_DIR}" UPLOADTHING_TOKEN "${BACKEND_UPLOADTHING_TOKEN}"
upsert_branch_env "${BACKEND_DIR}" RESEND_API_KEY "${BACKEND_RESEND_API_KEY}"
upsert_branch_env "${BACKEND_DIR}" UPSTASH_REDIS_REST_URL "${BACKEND_UPSTASH_URL}"
upsert_branch_env "${BACKEND_DIR}" UPSTASH_REDIS_REST_TOKEN "${BACKEND_UPSTASH_TOKEN}"
upsert_branch_env "${BACKEND_DIR}" COMMERCE_PAYMENTS_OPERATOR_KEY "${BACKEND_OPERATOR_KEY}"
upsert_branch_env "${BACKEND_DIR}" COMMERCE_PAYMENTS_FEE_BPS "${BACKEND_OPERATOR_FEE_BPS}"
upsert_branch_env "${BACKEND_DIR}" CHAIN_ENV "testnet"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_ENABLED "${BACKEND_ZERO_G_ENABLED}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_CHAIN_RPC_URL "${BACKEND_ZERO_G_CHAIN_RPC_URL}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_CHAIN_ID "${BACKEND_ZERO_G_CHAIN_ID}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_CHAIN_PRIVATE_KEY "${BACKEND_ZERO_G_CHAIN_PRIVATE_KEY}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_RECEIPT_ANCHOR_ADDRESS "${BACKEND_ZERO_G_RECEIPT_ANCHOR_ADDRESS}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_STORAGE_INDEXER_URL "${BACKEND_ZERO_G_STORAGE_INDEXER_URL}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_STORAGE_KV_RPC_URL "${BACKEND_ZERO_G_STORAGE_KV_RPC_URL}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_STORAGE_FLOW_ADDRESS "${BACKEND_ZERO_G_STORAGE_FLOW_ADDRESS}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_STORAGE_STREAM_ID "${BACKEND_ZERO_G_STORAGE_STREAM_ID}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_STORAGE_ENCRYPTION_KEY "${BACKEND_ZERO_G_STORAGE_ENCRYPTION_KEY}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_STORAGE_TARGET_MBPS "${BACKEND_ZERO_G_STORAGE_TARGET_MBPS}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_COMPUTE_ENABLED "${BACKEND_ZERO_G_COMPUTE_ENABLED}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_COMPUTE_PROVIDER "${BACKEND_ZERO_G_COMPUTE_PROVIDER}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_COMPUTE_BASE_URL "${BACKEND_ZERO_G_COMPUTE_BASE_URL}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_COMPUTE_API_KEY "${BACKEND_ZERO_G_COMPUTE_API_KEY}"
upsert_branch_env "${BACKEND_DIR}" ZERO_G_COMPUTE_MODEL "${BACKEND_ZERO_G_COMPUTE_MODEL}"

upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_APP_URL "${FRONTEND_BRANCH_URL}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_API_URL "${BACKEND_BRANCH_URL}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_PRIVY_APP_ID "${FRONTEND_PRIVY_APP_ID}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_CHAIN_ENV "testnet"
upsert_branch_env "${FRONTEND_DIR}" UPLOADTHING_SECRET "${FRONTEND_UPLOADTHING_SECRET}"
upsert_branch_env "${FRONTEND_DIR}" UPLOADTHING_APP_ID "${FRONTEND_UPLOADTHING_APP_ID}"
upsert_branch_env "${FRONTEND_DIR}" UPLOADTHING_TOKEN "${FRONTEND_UPLOADTHING_TOKEN}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_MOONPAY_API_KEY "${FRONTEND_MOONPAY_API_KEY}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_MOONPAY_ENV "${FRONTEND_MOONPAY_ENV}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_COINBASE_BUNDLER_KEY "${FRONTEND_BUNDLER_KEY}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS "${FRONTEND_SETTLEMENT_TOKEN_ADDRESS}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_SETTLEMENT_TOKEN_DECIMALS "${FRONTEND_SETTLEMENT_TOKEN_DECIMALS}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_SETTLEMENT_TOKEN_SYMBOL "${FRONTEND_SETTLEMENT_TOKEN_SYMBOL}"
upsert_branch_env "${FRONTEND_DIR}" NEXT_PUBLIC_SETTLEMENT_TOKEN_NAME "${FRONTEND_SETTLEMENT_TOKEN_NAME}"

echo "Synced Vercel preview env vars for branch '${DEV_BRANCH}'."
echo "Frontend preview URL: ${FRONTEND_BRANCH_URL}"
echo "Backend preview URL: ${BACKEND_BRANCH_URL}"
