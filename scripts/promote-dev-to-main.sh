#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_BRANCH="${1:-dev}"
MAIN_BRANCH="${2:-main}"

cd "${ROOT_DIR}"

if [[ -n "$(git status --short)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before promoting ${DEV_BRANCH}." >&2
  exit 1
fi

git fetch origin

git checkout "${DEV_BRANCH}"
git pull --ff-only origin "${DEV_BRANCH}"

"${ROOT_DIR}/scripts/check-all.sh"

git checkout "${MAIN_BRANCH}"
git pull --ff-only origin "${MAIN_BRANCH}"
git merge --ff-only "origin/${DEV_BRANCH}"
git push origin "${MAIN_BRANCH}"

git checkout "${DEV_BRANCH}"

echo "Promoted ${DEV_BRANCH} to ${MAIN_BRANCH} successfully."
