#!/usr/bin/env bash
set -euo pipefail

# Local prebuild + deploy to Vercel (saves 100% build minutes)
# Usage:
#   ./scripts/deploy.sh                  # deploy all projects
#   ./scripts/deploy.sh backend          # deploy backend (api.usecoal.xyz) only
#   ./scripts/deploy.sh frontend         # deploy frontend only
#   ./scripts/deploy.sh checkout         # deploy coal-react-checkout only
#   ./scripts/deploy.sh agent            # deploy coal-agent only
#   ./scripts/deploy.sh oracle           # deploy coal-oracle-agent only
#   ./scripts/deploy.sh backend agent    # deploy multiple

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECTS=("$@")

# Default: deploy all
if [ ${#PROJECTS[@]} -eq 0 ]; then
  PROJECTS=("backend" "frontend" "checkout" "agent" "oracle" "mcp")
fi

deploy_project() {
  local name="$1"
  local dir
  local needs_swap=0

  # Projects whose Vercel project.json has rootDirectory set must be deployed
  # from the parent of that root, not from inside it (otherwise Vercel
  # double-nests the path: e.g. rootDirectory=backend + cwd=backend → looks for
  # backend/backend). For those projects we deploy from the repo root.
  case "$name" in
    backend)   dir="$ROOT" ; needs_swap=1 ;;       # /coal/.vercel ↔ /coal/backend/.vercel
    frontend)  dir="$ROOT" ;;                      # /coal/.vercel already points at frontend project
    checkout)  dir="$ROOT/examples/coal-react-checkout" ;;
    agent)     dir="$ROOT/examples/coal-agent" ;;
    oracle)    dir="$ROOT/examples/coal-oracle-agent" ;;
    mcp)       dir="$ROOT/examples/coal-mcp-server" ;;
    store)     dir="$ROOT/examples/demo-store" ;;
    *)
      echo "Unknown project: $name (use: backend, frontend, checkout, agent, oracle, mcp, store)"
      return 1
      ;;
  esac

  echo ""
  echo "========================================="
  echo "  Deploying: $name"
  echo "  Dir: $dir"
  echo "========================================="

  # For backend, swap /coal/.vercel (frontend) with /coal/backend/.vercel so the
  # root-level deploy talks to the backend project. Restored on exit.
  if [ "$needs_swap" = "1" ]; then
    if [ -d "$ROOT/.vercel" ]; then
      mv "$ROOT/.vercel" "$ROOT/.vercel.swap-frontend"
    fi
    mv "$ROOT/backend/.vercel" "$ROOT/.vercel"
    trap 'mv "$ROOT/.vercel" "$ROOT/backend/.vercel"; [ -d "$ROOT/.vercel.swap-frontend" ] && mv "$ROOT/.vercel.swap-frontend" "$ROOT/.vercel" || true' RETURN
  fi

  cd "$dir"

  # Pull env vars from Vercel
  echo "[1/3] Pulling environment..."
  npx vercel pull --yes --environment=production 2>/dev/null || true

  # Clean stale build output (Vercel deploy is strict about prebuilt structure)
  rm -rf .vercel/output

  # Build locally
  echo "[2/3] Building locally..."
  npx vercel build --prod

  # Deploy prebuilt artifacts (no remote build)
  echo "[3/3] Deploying prebuilt..."
  npx vercel deploy --prebuilt --prod

  echo "  Done: $name"
}

echo "Coal Deploy (local prebuild, zero Vercel build minutes)"
echo "Projects: ${PROJECTS[*]}"

for proj in "${PROJECTS[@]}"; do
  deploy_project "$proj"
done

echo ""
echo "All deployments complete."
