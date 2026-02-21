#!/bin/bash
set -e

###############################################################################
# setup-foundry.sh
# Downloads, installs, and configures FoundryVTT in a DevContainer.
#
# Required environment variables:
#   FOUNDRY_USERNAME   – foundryvtt.com account email
#   FOUNDRY_PASSWORD   – foundryvtt.com account password
#   FOUNDRY_LICENSE_KEY – FoundryVTT license key
#   FOUNDRY_BUILD       – FoundryVTT build number (e.g. 351)
#
# These are provided automatically in both environments:
#
#   Codespaces:    Set as Codespaces Secrets on the repo.
#                  (Repo -> Settings -> Secrets -> Codespaces)
#                  GitHub injects them directly as env vars.
#
#   Local Docker:  Set as Windows User environment variables, then
#                  devcontainer.json remoteEnv forwards them into
#                  the container via ${localEnv:...}.
#                  Run:  powershell -File .devcontainer\set-local-secrets.ps1
###############################################################################

INSTALL_DIR="$HOME/foundryvtt"
DATA_DIR="$HOME/foundrydata"
MODULE_LINK="$DATA_DIR/Data/modules/wy-terminal"
WORKSPACE="/workspaces/foundryvtt-alienrpg-module"

# ── Detect environment ───────────────────────────────────────────────────────
if [ "${CODESPACES:-}" = "true" ]; then
  RUNTIME_ENV="codespaces"
  echo "── Environment: GitHub Codespaces ──"
else
  RUNTIME_ENV="local"
  echo "── Environment: Local Docker DevContainer ──"
fi

# ── Pre-flight checks ───────────────────────────────────────────────────────
missing=()
[ -z "$FOUNDRY_USERNAME" ]    && missing+=("FOUNDRY_USERNAME")
[ -z "$FOUNDRY_PASSWORD" ]    && missing+=("FOUNDRY_PASSWORD")
[ -z "$FOUNDRY_LICENSE_KEY" ] && missing+=("FOUNDRY_LICENSE_KEY")
[ -z "$FOUNDRY_BUILD" ]       && missing+=("FOUNDRY_BUILD")

if [ ${#missing[@]} -ne 0 ]; then
  echo "WARNING: Missing environment variables: ${missing[*]}"
  if [ "$RUNTIME_ENV" = "codespaces" ]; then
    echo "   Set them at: Repo -> Settings -> Secrets and variables -> Codespaces"
  else
    echo "   Set them as Windows User env vars, then rebuild the container:"
    echo "     powershell -File .devcontainer\\set-local-secrets.ps1"
    echo "   Or export them in this shell before re-running this script."
  fi
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

  # Extract CSRF token from cookie file
  CSRF_TOKEN=$(grep csrftoken "$COOKIE_FILE" | awk '{print $NF}')

  # Log in (include CSRF token as header and form field)
  # Note: don't follow redirects (-L) — a 302 means successful login
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" \
    -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "https://foundryvtt.com/auth/login/" \
    --data-urlencode "username=${FOUNDRY_USERNAME}" \
    --data-urlencode "password=${FOUNDRY_PASSWORD}" \
    --data-urlencode "csrfmiddlewaretoken=${CSRF_TOKEN}" \
    -H "Referer: https://foundryvtt.com" \
    -H "X-CSRFToken: ${CSRF_TOKEN}")

  if [ "$HTTP_CODE" -ne 302 ] && [ "$HTTP_CODE" -ge 400 ]; then
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

# ── Data directory ────────────────────────────────────────────────────────────
mkdir -p "$DATA_DIR/Data/modules"

# ── Write license key + admin password into options.json if not present ───────
OPTIONS_FILE="$DATA_DIR/Config/options.json"
mkdir -p "$(dirname "$OPTIONS_FILE")"

if [ ! -f "$OPTIONS_FILE" ]; then
  # Hash the admin password using the same algorithm as FoundryVTT:
  #   pbkdf2(password, salt, 1000 iterations, 64 bytes, sha512) → hex
  SALT=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex').slice(0,64))")
  ADMIN_HASH=$(node -e "
    const crypto = require('crypto');
    const hash = crypto.pbkdf2Sync(process.argv[1], process.argv[2], 1000, 64, 'sha512').toString('hex');
    console.log(hash);
  " "$FOUNDRY_PASSWORD" "$SALT")

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
  "world": "alienrpg-dev",
  "serviceConfig": null,
  "licenseKey": "$FOUNDRY_LICENSE_KEY",
  "adminPassword": "$ADMIN_HASH",
  "passwordSalt": "$SALT"
}
EOF
  echo "✔  Created options.json with license key and admin password"
fi

# ── Start FoundryVTT ─────────────────────────────────────────────────────────
mkdir -p "$DATA_DIR/logs"
echo "── Starting FoundryVTT on port 30000 ──"
nohup node "$INSTALL_DIR/resources/app/main.mjs" \
  --dataPath="$DATA_DIR" --port=30000 --host=0.0.0.0 \
  > "$DATA_DIR/logs/foundry-stdout.log" 2>&1 &
FVTT_PID=$!

echo "✔  FoundryVTT is starting (PID $FVTT_PID)"
echo "   Logs: $DATA_DIR/logs/foundry-stdout.log"

# ── Wait for Foundry to be ready, then activate the license ─────────────────
echo "── Waiting for FoundryVTT to be ready ──"
for i in $(seq 1 30); do
  if curl -sS -o /dev/null -w '' http://localhost:30000 2>/dev/null; then
    break
  fi
  sleep 1
done

# Activate the license key (signs it with the FoundryVTT servers)
echo "── Activating license key ──"
LICENSE_RESP=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:30000/license \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"enterKey\",\"licenseKey\":\"${FOUNDRY_LICENSE_KEY}\"}")

if [ "$LICENSE_RESP" = "302" ] || [ "$LICENSE_RESP" = "200" ]; then
  echo "✔  License activated"
else
  echo "⚠  License activation returned HTTP $LICENSE_RESP (may already be active)"
fi

# Accept the EULA
curl -sS -o /dev/null \
  -X POST http://localhost:30000/license \
  -H "Content-Type: application/json" \
  -d '{"action":"signAgreement","agreement":true}' 2>/dev/null || true

# ── Authenticate as admin ────────────────────────────────────────────────────
echo "── Authenticating as admin ──"
ADMIN_COOKIE=$(mktemp)
curl -sS -o /dev/null -c "$ADMIN_COOKIE" \
  -X POST http://localhost:30000/auth \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"adminAuth\",\"adminPassword\":\"${FOUNDRY_PASSWORD}\"}"

# ── Install AlienRPG system ─────────────────────────────────────────────────
ALIENRPG_MANIFEST="https://raw.githubusercontent.com/pwatson100/alienrpg/master/system.json"

if [ ! -d "$DATA_DIR/Data/systems/alienrpg" ]; then
  echo "── Installing AlienRPG system ──"
  curl -sS -b "$ADMIN_COOKIE" \
    -X POST http://localhost:30000/setup \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"installPackage\",\"type\":\"system\",\"manifest\":\"${ALIENRPG_MANIFEST}\"}"

  # Wait for the async install to finish
  for i in $(seq 1 30); do
    [ -f "$DATA_DIR/Data/systems/alienrpg/system.json" ] && break
    sleep 1
  done
  echo "✔  AlienRPG system installed"
else
  echo "✔  AlienRPG system already installed"
fi

# ── Deploy wy-terminal module via manifest, then replace with symlink ────────
WY_MANIFEST="https://raw.githubusercontent.com/BenTheCloudGuy/foundryvtt-alienrpg-module/refs/heads/main/module.json"

if [ ! -L "$MODULE_LINK" ]; then
  echo "── Installing wy-terminal module from manifest ──"
  curl -sS -b "$ADMIN_COOKIE" \
    -X POST http://localhost:30000/setup \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"installPackage\",\"type\":\"module\",\"manifest\":\"${WY_MANIFEST}\"}"

  # Wait for the async install to finish
  for i in $(seq 1 30); do
    [ -d "$DATA_DIR/Data/modules/wy-terminal" ] && break
    sleep 1
  done
  sleep 2

  # Replace downloaded copy with symlink so code changes are picked up live
  rm -rf "$MODULE_LINK"
  ln -sfn "$WORKSPACE" "$MODULE_LINK"
  echo "✔  Module installed and symlinked for live development"
else
  echo "✔  Module symlink already exists"
fi

# ── Install AlienRPG Starter Set (provides crew portrait images) ─────────────
STARTERSET_MANIFEST="https://foundrymodulesbucket.s3.eu-north-1.amazonaws.com/alienrpg-starterset/alienrpg-starterset-3.2.0.json"

if [ ! -d "$DATA_DIR/Data/modules/alienrpg-starterset" ]; then
  echo "── Installing AlienRPG Starter Set (portraits) ──"
  curl -sS -b "$ADMIN_COOKIE" \
    -X POST http://localhost:30000/setup \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"installPackage\",\"type\":\"module\",\"manifest\":\"${STARTERSET_MANIFEST}\"}"

  # Wait for the async install to finish
  for i in $(seq 1 60); do
    [ -d "$DATA_DIR/Data/modules/alienrpg-starterset" ] && break
    sleep 1
  done
  if [ -d "$DATA_DIR/Data/modules/alienrpg-starterset" ]; then
    echo "✔  AlienRPG Starter Set installed"
  else
    echo "⚠  AlienRPG Starter Set install may have failed (portraits will be missing)"
  fi
else
  echo "✔  AlienRPG Starter Set already installed"
fi

# ── Create alienrpg-dev world ───────────────────────────────────────────────
if [ ! -d "$DATA_DIR/Data/worlds/alienrpg-dev" ]; then
  echo "── Creating alienrpg-dev world ──"
  curl -sS -b "$ADMIN_COOKIE" \
    -X POST http://localhost:30000/setup \
    -H "Content-Type: application/json" \
    -d '{"action":"createWorld","id":"alienrpg-dev","title":"AlienRPG Dev","system":"alienrpg","background":"","nextSession":null,"description":"Development world for AlienRPG module testing"}' > /dev/null
  echo "✔  World 'alienrpg-dev' created (system: alienrpg)"
  WORLD_CREATED=1
else
  echo "✔  World 'alienrpg-dev' already exists"
  WORLD_CREATED=0
fi

rm -f "$ADMIN_COOKIE"

# ── Configure world data (users, module, actors, settings) ──────────────────
# LevelDB requires exclusive access — stop Foundry, configure, restart
if [ "$WORLD_CREATED" = "1" ]; then
  echo "── Configuring world data ──"
  kill "$FVTT_PID" 2>/dev/null || true
  sleep 2

  node "$WORKSPACE/.devcontainer/configure-world.mjs"

  echo "── Restarting FoundryVTT ──"
  nohup node "$INSTALL_DIR/resources/app/main.mjs" \
    --dataPath="$DATA_DIR" --port=30000 --host=0.0.0.0 \
    > "$DATA_DIR/logs/foundry-stdout.log" 2>&1 &
  FVTT_PID=$!

  # Wait for Foundry to be ready again
  for i in $(seq 1 30); do
    if curl -sS -o /dev/null -w '' http://localhost:30000 2>/dev/null; then
      break
    fi
    sleep 1
  done
fi

# ── Launch the alienrpg-dev world ────────────────────────────────────────────
echo "── Launching alienrpg-dev world ──"

# Re-authenticate as admin (new session after restart)
ADMIN_COOKIE=$(mktemp)
curl -sS -o /dev/null -c "$ADMIN_COOKIE" \
  -X POST http://localhost:30000/auth \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"adminAuth\",\"adminPassword\":\"${FOUNDRY_PASSWORD}\"}"

curl -sS -b "$ADMIN_COOKIE" \
  -X POST http://localhost:30000/setup \
  -H "Content-Type: application/json" \
  -d '{"action":"launchWorld","world":"alienrpg-dev"}' > /dev/null 2>&1 || true
echo "✔  World 'alienrpg-dev' launched"

rm -f "$ADMIN_COOKIE"

echo "FoundryVTT is ready on port 30000"
echo "   Environment: $RUNTIME_ENV"
echo "   Admin password: (same as FOUNDRY_PASSWORD)"
echo "   World: alienrpg-dev (auto-launched)"
