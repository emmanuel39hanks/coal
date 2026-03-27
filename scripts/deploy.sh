#!/usr/bin/env bash
set -euo pipefail

# Local prebuild + deploy to Vercel (saves 100% build minutes)
# Usage:
#   ./scripts/deploy.sh                  # deploy all projects
#   ./scripts/deploy.sh frontend         # deploy frontend only
#   ./scripts/deploy.sh checkout         # deploy coal-react-checkout only
#   ./scripts/deploy.sh agent            # deploy coal-agent only
#   ./scripts/deploy.sh frontend agent   # deploy multiple

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECTS=("$@")

# Default: deploy all
if [ ${#PROJECTS[@]} -eq 0 ]; then
  PROJECTS=("frontend" "checkout" "agent")
fi

deploy_project() {
  local name="$1"
  local dir

  case "$name" in
    frontend)  dir="$ROOT/frontend" ;;
    checkout)  dir="$ROOT/examples/coal-react-checkout" ;;
    agent)     dir="$ROOT/examples/coal-agent" ;;
    *)
      echo "Unknown project: $name (use: frontend, checkout, agent)"
      return 1
      ;;
  esac

  echo ""
  echo "========================================="
  echo "  Deploying: $name"
  echo "  Dir: $dir"
  echo "========================================="

  cd "$dir"

  # Pull env vars from Vercel
  echo "[1/3] Pulling environment..."
  npx vercel pull --yes --environment=production 2>/dev/null || true

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
