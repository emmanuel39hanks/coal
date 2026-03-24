#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Backend typecheck"
(cd "${ROOT_DIR}/backend" && npm run typecheck)

echo "==> Backend test"
(cd "${ROOT_DIR}/backend" && npm test)

echo "==> Backend build"
(cd "${ROOT_DIR}/backend" && npm run build)

echo "==> Frontend typecheck"
(cd "${ROOT_DIR}/frontend" && npm run typecheck)

echo "==> Frontend build"
(cd "${ROOT_DIR}/frontend" && npm run build)

echo "==> All checks passed"
