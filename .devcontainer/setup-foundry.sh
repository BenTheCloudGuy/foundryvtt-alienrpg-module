#!/bin/bash
set -e

###############################################################################
# setup-foundry.sh
# Downloads, installs, and configures FoundryVTT in a Codespace using
# repository Codespaces secrets:
#   FOUNDRY_USERNAME   – foundryvtt.com account email
#   FOUNDRY_PASSWORD   – foundryvtt.com account password
#   FOUNDRY_LICENSE_KEY – FoundryVTT license key
#   FOUNDRY_BUILD       – FoundryVTT build number (e.g. 351)
###############################################################################

INSTALL_DIR="$HOME/foundryvtt"
DATA_DIR="$HOME/foundrydata"
MODULE_LINK="$DATA_DIR/Data/modules/wy-terminal"
WORKSPACE="/workspaces/foundryvtt-alienrpg-module"

# ── Pre-flight checks ───────────────────────────────────────────────────────
missing=()
[ -z "$FOUNDRY_USERNAME" ]    && missing+=("FOUNDRY_USERNAME")
[ -z "$FOUNDRY_PASSWORD" ]    && missing+=("FOUNDRY_PASSWORD")
[ -z "$FOUNDRY_LICENSE_KEY" ] && missing+=("FOUNDRY_LICENSE_KEY")
[ -z "$FOUNDRY_BUILD" ]       && missing+=("FOUNDRY_BUILD")

if [ ${#missing[@]} -ne 0 ]; then
  echo "⚠  Missing Codespaces secrets: ${missing[*]}"
  echo "   Set them at: Repo → Settings → Secrets → Codespaces"
  echo "   Skipping FoundryVTT installation."
  exit 0
fi

# ── Skip if already installed ────────────────────────────────────────────────
if [ -f "$INSTALL_DIR/resources/app/main.mjs" ]; then
  echo "✔  FoundryVTT already installed at $INSTALL_DIR"
else
  echo "── Authenticating with foundryvtt.com ──"
  COOKIE_FILE=$(mktemp)

  # Get CSRF token / session cookie
  curl -sSL -c "$COOKIE_FILE" "https://foundryvtt.com" > /dev/null

  # Log in
  HTTP_CODE=$(curl -sSL -o /dev/null -w "%{http_code}" \
    -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "https://foundryvtt.com/auth/login/" \
    --data-urlencode "username=${FOUNDRY_USERNAME}" \
    --data-urlencode "password=${FOUNDRY_PASSWORD}" \
    -H "Referer: https://foundryvtt.com")

  if [ "$HTTP_CODE" -ge 400 ]; then
    echo "✖  Login failed (HTTP $HTTP_CODE). Check FOUNDRY_USERNAME / FOUNDRY_PASSWORD."
    rm -f "$COOKIE_FILE"
    exit 1
  fi
  echo "✔  Logged in to foundryvtt.com"

  # Download the Linux/NodeJS build
  echo "── Downloading FoundryVTT build ${FOUNDRY_BUILD} (linux) ──"
  curl -sSL -b "$COOKIE_FILE" -o /tmp/foundryvtt.zip \
    "https://foundryvtt.com/releases/download?build=${FOUNDRY_BUILD}&platform=linux"

  rm -f "$COOKIE_FILE"

  # Validate zip
  if ! unzip -tq /tmp/foundryvtt.zip > /dev/null 2>&1; then
    echo "✖  Downloaded file is not a valid zip. Check FOUNDRY_BUILD number."
    rm -f /tmp/foundryvtt.zip
    exit 1
  fi

  # Extract
  echo "── Installing to $INSTALL_DIR ──"
  mkdir -p "$INSTALL_DIR"
  unzip -qo /tmp/foundryvtt.zip -d "$INSTALL_DIR"
  rm -f /tmp/foundryvtt.zip
  echo "✔  FoundryVTT installed"
fi

# ── Data directory & module symlink ──────────────────────────────────────────
mkdir -p "$DATA_DIR/Data/modules"

if [ ! -L "$MODULE_LINK" ]; then
  ln -sfn "$WORKSPACE" "$MODULE_LINK"
  echo "✔  Symlinked module → $MODULE_LINK"
fi

# ── Write license key into options.json if not present ───────────────────────
OPTIONS_FILE="$DATA_DIR/Config/options.json"
mkdir -p "$(dirname "$OPTIONS_FILE")"

if [ ! -f "$OPTIONS_FILE" ]; then
  cat > "$OPTIONS_FILE" <<EOF
{
  "port": 30000,
  "upnp": false,
  "fullscreen": false,
  "hostname": null,
  "localHostname": null,
  "routePrefix": null,
  "sslCert": null,
  "sslKey": null,
  "awsConfig": null,
  "dataPath": "$DATA_DIR",
  "compressStatic": true,
  "proxySSL": true,
  "proxyPort": 443,
  "minifyStaticFiles": true,
  "updateChannel": "stable",
  "language": "en.core",
  "world": null,
  "serviceConfig": null,
  "licenseKey": "$FOUNDRY_LICENSE_KEY"
}
EOF
  echo "✔  Created options.json with license key"
fi

# ── Start FoundryVTT ─────────────────────────────────────────────────────────
echo "── Starting FoundryVTT on port 30000 ──"
nohup node "$INSTALL_DIR/resources/app/main.mjs" \
  --dataPath="$DATA_DIR" --port=30000 \
  > "$DATA_DIR/logs/foundry-stdout.log" 2>&1 &

echo "✔  FoundryVTT is starting (PID $!)"
echo "   Logs: $DATA_DIR/logs/foundry-stdout.log"
