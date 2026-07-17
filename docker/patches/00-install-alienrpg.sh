#!/usr/bin/env bash
# 00-install-alienrpg.sh
#
# Sourced by the felddy/foundryvtt entrypoint AFTER FoundryVTT has been
# downloaded/installed/licensed, but BEFORE the server is launched.
#
# This is done at container start-up (not build time) because the felddy base
# image declares `VOLUME ["/data"]`; any build-time writes to /data are
# discarded. At this point /data is mounted and writable, so we can:
#
#   1. Install the Alien RPG game system into /data/Data/systems
#   2. Install the Weyland-Yutani Ship Terminal module into /data/Data/modules
#   3. Create an Alien RPG game world (world.json with correct core/system
#      versions so Foundry does not prompt for a migration)
#   4. Best-effort pre-enable the wy-terminal module in the new world
#
# The world is then launched automatically via the FOUNDRY_WORLD environment
# variable, so the container comes up ready to play with no user interaction.
#
# `log`, `log_warn`, `log_error` and `DATA_DIR` are provided by the entrypoint
# that sources this file. The working directory is $HOME, where the installed
# Foundry application lives under ./resources/app.

_ARPG_SRC="${ALIENRPG_CONTENT_DIR:-/opt/alienrpg/content}"
_ARPG_SYSTEM_ID="alienrpg"
_ARPG_MODULE_ID="wy-terminal"
_ARPG_WORLD_ID="${FOUNDRY_WORLD:-alienrpg-cog}"
_ARPG_WORLD_TITLE="${ALIENRPG_WORLD_TITLE:-Alien RPG — Chariot of the Gods}"

_ARPG_DATA="${DATA_DIR}/Data"

log "Alien RPG: preparing system, module, and world."

mkdir -p "${_ARPG_DATA}/systems" "${_ARPG_DATA}/modules" "${_ARPG_DATA}/worlds"

# ── Install the Alien RPG system (only if not already present) ──────────────
if [ -d "${_ARPG_DATA}/systems/${_ARPG_SYSTEM_ID}" ]; then
  log "Alien RPG: system already installed; leaving existing copy untouched."
elif [ -d "${_ARPG_SRC}/systems/${_ARPG_SYSTEM_ID}" ]; then
  log "Alien RPG: installing '${_ARPG_SYSTEM_ID}' system."
  cp -a "${_ARPG_SRC}/systems/${_ARPG_SYSTEM_ID}" "${_ARPG_DATA}/systems/"
else
  log_warn "Alien RPG: bundled system not found at ${_ARPG_SRC}/systems/${_ARPG_SYSTEM_ID}."
fi

# ── Install the wy-terminal module (only if not already present) ────────────
if [ -d "${_ARPG_DATA}/modules/${_ARPG_MODULE_ID}" ]; then
  log "Alien RPG: module '${_ARPG_MODULE_ID}' already installed; leaving existing copy untouched."
elif [ -d "${_ARPG_SRC}/modules/${_ARPG_MODULE_ID}" ]; then
  log "Alien RPG: installing '${_ARPG_MODULE_ID}' module."
  cp -a "${_ARPG_SRC}/modules/${_ARPG_MODULE_ID}" "${_ARPG_DATA}/modules/"
else
  log_warn "Alien RPG: bundled module not found at ${_ARPG_SRC}/modules/${_ARPG_MODULE_ID}."
fi

# ── Create the game world + pre-enable the module (best effort) ─────────────
# Delegated to Node so we can read the installed Foundry version, parse the
# system manifest, and write both the world manifest and the LevelDB settings
# entry using Foundry's own bundled classic-level dependency.
ALIENRPG_WORLD_ID="${_ARPG_WORLD_ID}" \
ALIENRPG_WORLD_TITLE="${_ARPG_WORLD_TITLE}" \
ALIENRPG_SYSTEM_ID="${_ARPG_SYSTEM_ID}" \
ALIENRPG_MODULE_ID="${_ARPG_MODULE_ID}" \
ALIENRPG_DATA_DIR="${_ARPG_DATA}" \
ALIENRPG_APP_DIR="${PWD}/resources/app" \
node <<'NODE'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const worldId = process.env.ALIENRPG_WORLD_ID;
const worldTitle = process.env.ALIENRPG_WORLD_TITLE;
const systemId = process.env.ALIENRPG_SYSTEM_ID;
const moduleId = process.env.ALIENRPG_MODULE_ID;
const dataDir = process.env.ALIENRPG_DATA_DIR;
const appDir = process.env.ALIENRPG_APP_DIR;

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

// Installed Foundry core version, e.g. "13.348" (generation.build).
let coreVersion = '13';
const appPkg = readJSON(path.join(appDir, 'package.json'));
if (appPkg && appPkg.release && appPkg.release.generation != null) {
  coreVersion = `${appPkg.release.generation}.${appPkg.release.build ?? 0}`;
} else if (appPkg && appPkg.version) {
  coreVersion = String(appPkg.version);
}

// Installed system version.
let systemVersion = '0.0.0';
const sysJson = readJSON(path.join(dataDir, 'systems', systemId, 'system.json'));
if (sysJson && sysJson.version) systemVersion = String(sysJson.version);

const worldDir = path.join(dataDir, 'worlds', worldId);
const worldJsonPath = path.join(worldDir, 'world.json');
fs.mkdirSync(worldDir, { recursive: true });

if (!fs.existsSync(worldJsonPath)) {
  const world = {
    id: worldId,
    title: worldTitle,
    description: 'Alien RPG world with the Weyland-Yutani Ship Terminal pre-installed.',
    system: systemId,
    coreVersion,
    systemVersion,
    lastPlayed: '',
    playtime: 0,
  };
  fs.writeFileSync(worldJsonPath, `${JSON.stringify(world, null, 2)}\n`);
  console.log(`[alienrpg] Created world '${worldId}' (core ${coreVersion}, system ${systemVersion}).`);
} else {
  console.log(`[alienrpg] World '${worldId}' already exists; leaving manifest untouched.`);
}

// Best-effort: pre-enable the module by seeding the world settings LevelDB.
// If anything here fails, the world still launches fine and the GM can enable
// the module with a single click in the UI.
try {
  const settingsDir = path.join(worldDir, 'data', 'settings');
  // Only seed a brand-new world so we never clobber existing settings.
  if (!fs.existsSync(settingsDir)) {
    // Use FoundryVTT's own bundled native LevelDB bindings (native addons are
    // shipped under resources/app/node_modules and cannot be webpacked away).
    let ClassicLevel;
    const clSearchPaths = [
      path.join(appDir, 'node_modules'),
      appDir,
    ];
    try {
      ({ ClassicLevel } = require(require.resolve('classic-level', { paths: clSearchPaths })));
    } catch {
      ({ ClassicLevel } = require('classic-level'));
    }

    fs.mkdirSync(settingsDir, { recursive: true });
    const docId = crypto.randomBytes(12).toString('base64')
      .replace(/[^A-Za-z0-9]/g, '').slice(0, 16).padEnd(16, '0');
    const now = Date.now();
    const doc = {
      _id: docId,
      key: 'core.moduleConfiguration',
      value: JSON.stringify({ [moduleId]: true }),
      user: null,
      _stats: {
        compendiumSource: null,
        duplicateSource: null,
        coreVersion,
        systemId,
        systemVersion,
        createdTime: now,
        modifiedTime: now,
        lastModifiedBy: null,
      },
    };

    (async () => {
      const db = new ClassicLevel(settingsDir, { keyEncoding: 'utf8', valueEncoding: 'json' });
      await db.open();
      await db.put(`!settings!${docId}`, doc);
      await db.close();
      console.log(`[alienrpg] Pre-enabled module '${moduleId}' in world '${worldId}'.`);
    })().catch((err) => {
      console.log(`[alienrpg] Skipped module pre-enable: ${err.message}`);
    });
  } else {
    console.log(`[alienrpg] World settings already exist; not modifying module configuration.`);
  }
} catch (err) {
  console.log(`[alienrpg] Skipped module pre-enable: ${err.message}`);
}
NODE

log "Alien RPG: content and world ready. World '${_ARPG_WORLD_ID}' will launch on start."
