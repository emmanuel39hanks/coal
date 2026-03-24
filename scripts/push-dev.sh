#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_BRANCH="${1:-dev}"

cd "${ROOT_DIR}"

CURRENT_BRANCH="$(git branch --show-current)"

if [[ "${CURRENT_BRANCH}" != "${TARGET_BRANCH}" ]]; then
  echo "Expected to be on '${TARGET_BRANCH}', but currently on '${CURRENT_BRANCH}'." >&2
  exit 1
fi

if [[ -n "$(git status --short)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before pushing ${TARGET_BRANCH}." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/check-all.sh"

git push -u origin "${TARGET_BRANCH}"

echo "Pushed ${TARGET_BRANCH} successfully."
