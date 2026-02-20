#!/usr/bin/env bash
# .devcontainer/scripts/start-foundry.sh
#
# Starts a FoundryVTT server from within the dev container.
#
# Prerequisites (see .devcontainer/README.md):
#   1. Place your unzipped FoundryVTT server files under .foundry/server/
#      inside the repository root.  The directory should contain
#      resources/app/main.js (the FoundryVTT Node entrypoint).
#   2. (Optional) Set FOUNDRY_PORT to use a port other than 30000.
#
# Usage:
#   bash .devcontainer/scripts/start-foundry.sh

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FOUNDRY_PORT="${FOUNDRY_PORT:-30000}"
FOUNDRY_SERVER_DIR="${REPO_ROOT}/.foundry/server"
FOUNDRY_DATA_DIR="${REPO_ROOT}/.foundry/data"
MODULE_ID="wy-terminal"
MODULE_LINK="${FOUNDRY_DATA_DIR}/Data/modules/${MODULE_ID}"
FOUNDRY_MAIN="${FOUNDRY_SERVER_DIR}/resources/app/main.js"

# ── Validation ───────────────────────────────────────────────────────────────
if [[ ! -f "${FOUNDRY_MAIN}" ]]; then
  echo ""
  echo "ERROR: FoundryVTT server files not found at:"
  echo "  ${FOUNDRY_SERVER_DIR}/resources/app/main.js"
  echo ""
  echo "Please follow the setup steps in .devcontainer/README.md:"
  echo "  1. Download FoundryVTT v12+ (Linux/Node) from https://foundryvtt.com"
  echo "  2. Unzip the archive into .foundry/server/ inside the repo root."
  echo "  3. Re-run this script."
  echo ""
  exit 1
fi

# ── Data directory & module symlink ──────────────────────────────────────────
mkdir -p "${FOUNDRY_DATA_DIR}/Data/modules"

if [[ -L "${MODULE_LINK}" ]]; then
  echo "Module symlink already exists: ${MODULE_LINK}"
elif [[ -e "${MODULE_LINK}" ]]; then
  echo "WARNING: ${MODULE_LINK} exists but is not a symlink — leaving it alone."
else
  ln -s "${REPO_ROOT}" "${MODULE_LINK}"
  echo "Created module symlink: ${MODULE_LINK} -> ${REPO_ROOT}"
fi

# ── Start FoundryVTT ─────────────────────────────────────────────────────────
echo ""
echo "Starting FoundryVTT on port ${FOUNDRY_PORT} …"
echo "  Server files : ${FOUNDRY_SERVER_DIR}"
echo "  Data path    : ${FOUNDRY_DATA_DIR}"
echo "  Module link  : ${MODULE_LINK}"
echo ""
echo "Open http://localhost:${FOUNDRY_PORT} in your browser (or use the"
echo "forwarded port URL shown in the Ports panel)."
echo ""

exec node "${FOUNDRY_MAIN}" \
  --dataPath="${FOUNDRY_DATA_DIR}" \
  --port="${FOUNDRY_PORT}" \
  --host=0.0.0.0
