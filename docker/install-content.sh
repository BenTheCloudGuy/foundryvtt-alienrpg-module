#!/usr/bin/env sh
# install-content.sh
#
# Build-time helper that stages the Alien RPG game system and the
# Weyland-Yutani Ship Terminal (wy-terminal) module so they can be baked
# into the FoundryVTT image.
#
# Usage:
#   install-content.sh <ALIENRPG_MANIFEST_URL> <OUT_DIR> <MODULE_SRC_DIR>
#
#   <ALIENRPG_MANIFEST_URL>  URL of the Alien RPG system.json manifest.
#   <OUT_DIR>                Staging dir. Populated with systems/ and modules/.
#   <MODULE_SRC_DIR>         Path to the wy-terminal module source (repo root).
set -eu

ALIENRPG_MANIFEST_URL="${1:?manifest url required}"
OUT_DIR="${2:?output dir required}"
MODULE_SRC_DIR="${3:?module source dir required}"

MODULE_ID="wy-terminal"

SYSTEMS_DIR="${OUT_DIR}/systems"
MODULES_DIR="${OUT_DIR}/modules"
mkdir -p "${SYSTEMS_DIR}" "${MODULES_DIR}"

echo "── Fetching Alien RPG system manifest ──"
echo "   ${ALIENRPG_MANIFEST_URL}"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

curl -fsSL "${ALIENRPG_MANIFEST_URL}" -o "${tmp}/system.json"

ALIENRPG_ID="$(jq -r '.id' "${tmp}/system.json")"
ALIENRPG_VERSION="$(jq -r '.version' "${tmp}/system.json")"
DOWNLOAD_URL="$(jq -r '.download' "${tmp}/system.json")"

if [ -z "${DOWNLOAD_URL}" ] || [ "${DOWNLOAD_URL}" = "null" ]; then
  echo "✖  Manifest has no 'download' URL" >&2
  exit 1
fi

echo "── Downloading ${ALIENRPG_ID} v${ALIENRPG_VERSION} ──"
echo "   ${DOWNLOAD_URL}"
curl -fsSL "${DOWNLOAD_URL}" -o "${tmp}/system.zip"

if ! unzip -tq "${tmp}/system.zip" >/dev/null 2>&1; then
  echo "✖  Downloaded system archive is not a valid zip" >&2
  exit 1
fi

echo "── Extracting system ──"
unzip -qo "${tmp}/system.zip" -d "${tmp}/extract"

# The archive may contain system.json at the root or nested inside a folder.
SYSTEM_JSON_PATH="$(find "${tmp}/extract" -maxdepth 3 -name system.json | head -n 1)"
if [ -z "${SYSTEM_JSON_PATH}" ]; then
  echo "✖  Could not locate system.json inside the extracted archive" >&2
  exit 1
fi
SYSTEM_ROOT="$(dirname "${SYSTEM_JSON_PATH}")"

TARGET="${SYSTEMS_DIR}/${ALIENRPG_ID}"
rm -rf "${TARGET}"
mkdir -p "${TARGET}"
cp -a "${SYSTEM_ROOT}/." "${TARGET}/"
echo "✔  Installed system to ${TARGET}"

echo "── Staging ${MODULE_ID} module ──"
MODULE_TARGET="${MODULES_DIR}/${MODULE_ID}"
rm -rf "${MODULE_TARGET}"
mkdir -p "${MODULE_TARGET}"

# Copy only the files FoundryVTT needs at runtime. Everything else in the repo
# (build tooling, docker/, .github/, extraction scripts, etc.) is skipped.
for item in module.json README.md CHANGELOG.md \
            scripts styles templates lang packs images media muthur status; do
  if [ -e "${MODULE_SRC_DIR}/${item}" ]; then
    cp -a "${MODULE_SRC_DIR}/${item}" "${MODULE_TARGET}/"
  fi
done
echo "✔  Staged module to ${MODULE_TARGET}"

echo "── Content staging complete ──"
find "${OUT_DIR}" -maxdepth 2 -type d | sort
