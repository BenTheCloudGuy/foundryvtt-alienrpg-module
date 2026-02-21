#!/usr/bin/env node
/**
 * configure-world.mjs
 * Post-launch world configuration for the alienrpg-dev world.
 * Runs AFTER FoundryVTT is stopped so LevelDB is unlocked.
 *
 * Tasks:
 *  1. Enable the wy-terminal module
 *  2. Create a "player-terminal" user (PLAYER role, no password)
 *  3. Import all actors from the wyt-cog-actors compendium pack
 *  4. Set recommended GM-Terminal default settings
 */

import { ClassicLevel } from 'classic-level';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.join(process.env.HOME, 'foundrydata');
const WORLD_DIR = path.join(DATA_DIR, 'Data', 'worlds', 'alienrpg-dev');
const WORLD_DATA = path.join(WORLD_DIR, 'data');
const MODULE_DIR = path.join(DATA_DIR, 'Data', 'modules', 'wy-terminal');
const COMPENDIUM_SRC = path.join(MODULE_DIR, 'compendium-src', 'wyt-cog-actors');

function randomId(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) id += chars[bytes[i] % chars.length];
  return id;
}

const NOW = Date.now();
const CORE_VERSION = '13.351';
const SYSTEM_ID = 'alienrpg';
const SYSTEM_VERSION = '4.0.0';

function makeStats(extra = {}) {
  return {
    coreVersion: CORE_VERSION,
    systemId: SYSTEM_ID,
    systemVersion: SYSTEM_VERSION,
    createdTime: NOW,
    modifiedTime: NOW,
    lastModifiedBy: null,
    compendiumSource: null,
    duplicateSource: null,
    exportSource: null,
    ...extra,
  };
}

// ── 1. Enable wy-terminal module ────────────────────────────────────────────
async function enableModule(settingsDb) {
  let configId = null;
  let existing = {};

  for await (const [key, value] of settingsDb.iterator()) {
    if (value.key === 'core.moduleConfiguration') {
      configId = value._id;
      try { existing = JSON.parse(value.value); } catch {}
      break;
    }
  }

  if (existing['wy-terminal']) {
    console.log('  ✔  wy-terminal module already enabled');
    return;
  }

  existing['wy-terminal'] = true;
  const id = configId || randomId();
  const doc = {
    key: 'core.moduleConfiguration',
    value: JSON.stringify(existing),
    _id: id,
    user: null,
    _stats: makeStats(),
  };
  await settingsDb.put(`!settings!${id}`, doc);
  console.log('  ✔  Enabled wy-terminal module');
}

// ── 2. Create player-terminal user ──────────────────────────────────────────
async function createPlayerTerminal(usersDb) {
  for await (const [key, value] of usersDb.iterator()) {
    if (value.name === 'player-terminal') {
      console.log('  ✔  player-terminal user already exists');
      return;
    }
  }

  const id = randomId();
  const user = {
    name: 'player-terminal',
    role: 1, // PLAYER
    _id: id,
    password: '',
    passwordSalt: null,
    avatar: null,
    character: null,
    color: '#00ff41',
    pronouns: '',
    hotbar: {},
    permissions: {},
    flags: {},
    _stats: makeStats(),
  };
  await usersDb.put(`!users!${id}`, user);
  console.log('  ✔  Created player-terminal user (PLAYER, no password)');
}

// ── 3. Import wyt-cog-actors from compendium-src JSON files ─────────────────
async function importCompendiumActors(actorsDb, foldersDb) {
  // Check if actors already exist
  let actorCount = 0;
  for await (const _ of actorsDb.iterator()) actorCount++;
  if (actorCount > 0) {
    console.log(`  ✔  Actors already imported (${actorCount} found)`);
    return;
  }

  // Map subfolder names to display names
  const FOLDER_CONFIG = {
    montero:   { name: 'Montero Crew',  color: '#28cc72' },
    cronus:    { name: 'Cronus Crew',    color: '#28cc72' },
    sotillo:   { name: 'Sotillo Crew',   color: '#28cc72' },
    creatures: { name: 'Creatures',      color: '#cc2828' },
  };

  if (!fs.existsSync(COMPENDIUM_SRC)) {
    console.error(`  ✖  Compendium source not found: ${COMPENDIUM_SRC}`);
    return;
  }

  // Discover subfolders and create matching world Actor folders
  const folderIdMap = {};  // subfolder name → world folder _id
  const subfolders = fs.readdirSync(COMPENDIUM_SRC, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const sub of subfolders) {
    const cfg = FOLDER_CONFIG[sub] || { name: sub, color: '#888888' };
    const folderId = randomId();
    folderIdMap[sub] = folderId;
    const folder = {
      name: cfg.name,
      type: 'Actor',
      _id: folderId,
      description: '',
      sorting: 'a',
      sort: 0,
      color: cfg.color,
      flags: {},
      folder: null,
      _stats: makeStats(),
    };
    await foldersDb.put(`!folders!${folderId}`, folder);
  }

  // Import each .json actor file, assigning to the correct folder
  let imported = 0;
  for (const sub of subfolders) {
    const dirPath = path.join(COMPENDIUM_SRC, sub);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const raw = fs.readFileSync(path.join(dirPath, file), 'utf-8');
      const actor = JSON.parse(raw);

      const origId = actor._id;
      const newId = randomId();
      actor._id = newId;
      actor.folder = folderIdMap[sub] || null;
      actor._stats = makeStats({ compendiumSource: `Compendium.wy-terminal.wyt-cog-actors.Actor.${origId}` });
      actor.ownership = { default: 0 };

      await actorsDb.put(`!actors!${newId}`, actor);
      imported++;
    }
  }

  console.log(`  ✔  Imported ${imported} actors from compendium-src into ${subfolders.length} folders: ${subfolders.map(s => FOLDER_CONFIG[s]?.name || s).join(', ')}`);
  return folderIdMap;
}

// ── 4. Set recommended GM-Terminal default settings ─────────────────────────
async function setDefaultSettings(settingsDb, foldersDb) {
  // Collect existing setting keys
  const existingKeys = new Set();
  for await (const [key, value] of settingsDb.iterator()) {
    existingKeys.add(value.key);
  }

  // Default recommended settings for development
  const defaults = {
    // Ship / scenario defaults
    'wy-terminal.activeShip':     'montero',
    'wy-terminal.shipName':       'USCSS MONTERO',
    'wy-terminal.shipClass':      'M-CLASS STARFREIGHTER',
    'wy-terminal.shipRegistry':   'REG# 220-8170421',
    'wy-terminal.missionName':    'CHARIOTS OF THE GODS',
    'wy-terminal.muthurPlugin':   'montero',
    'wy-terminal.statusPath':     'modules/wy-terminal/status',

    // CRT effects
    'wy-terminal.scanlines':      'medium',
    'wy-terminal.crtFlicker':     'medium',

    // Comm frequency
    'wy-terminal.commFrequency':  '475.12',

    // Game clock: 2183-06-12 06:00 UTC
    'wy-terminal.gameClockEpoch': String(Date.UTC(2183, 5, 12, 6, 0, 0)),
    'wy-terminal.gameClockPaused': true,

    // AI / OpenAI settings — auto-populate from OPENAI_API_KEY env var if set
    'wy-terminal.openaiBaseUrl':  'https://api.openai.com/v1',
    'wy-terminal.openaiModel':    'gpt-4o-mini',

    // ── Crew folder filter (only show selected folders in CREW view) ──
    // Look up the 'Montero Crew' folder ID from the folders DB
    // (will be populated below after folder lookup)

    // ── Optimized FoundryVTT core settings (mirrors "OPTIMIZE FOUNDRYVTT SETTINGS" button) ──
    'core.tokenAutoRotate':       false,
    'core.tokenDragPreview':      false,
    'core.scrollingStatusText':   false,

    // Restrict AV and cursor permissions (FoundryVTT v13 defaults with optimize overrides)
    // Role IDs: NONE=0, PLAYER=1, TRUSTED=2, ASSISTANT=3, GAMEMASTER=4
    'core.permissions': {
      ACTOR_CREATE:       [3, 4],       // ASSISTANT + GM
      BROADCAST_AUDIO:    [3, 4],       // ASSISTANT + GM  (default [2,3], optimized)
      BROADCAST_VIDEO:    [2, 3, 4],    // TRUSTED + ASSISTANT + GM  (default [2,3], optimized)
      CARDS_CREATE:       [3, 4],       // ASSISTANT + GM
      DRAWING_CREATE:     [2, 3, 4],    // TRUSTED + ASSISTANT + GM
      FILES_BROWSE:       [2, 3, 4],    // TRUSTED + ASSISTANT + GM
      FILES_UPLOAD:       [3, 4],       // ASSISTANT + GM
      ITEM_CREATE:        [3, 4],       // ASSISTANT + GM
      JOURNAL_CREATE:     [2, 3, 4],    // TRUSTED + ASSISTANT + GM
      MACRO_SCRIPT:       [1, 2, 3, 4], // PLAYER + TRUSTED + ASSISTANT + GM
      MESSAGE_WHISPER:    [1, 2, 3, 4], // PLAYER + TRUSTED + ASSISTANT + GM
      NOTE_CREATE:        [2, 3, 4],    // TRUSTED + ASSISTANT + GM
      PING_CANVAS:        [1, 2, 3],    // PLAYER + TRUSTED + ASSISTANT (disableGM)
      PLAYLIST_CREATE:    [3, 4],       // ASSISTANT + GM
      SETTINGS_MODIFY:    [3, 4],       // ASSISTANT + GM
      SHOW_CURSOR:        [],           // NOBODY  (default [1,2,3], optimized)
      SHOW_RULER:         [1, 2, 3],    // PLAYER + TRUSTED + ASSISTANT (disableGM)
      TEMPLATE_CREATE:    [1, 2, 3, 4], // PLAYER + TRUSTED + ASSISTANT + GM
      TOKEN_CREATE:       [3, 4],       // ASSISTANT + GM
      TOKEN_DELETE:       [3, 4],       // ASSISTANT + GM
      TOKEN_CONFIGURE:    [2, 3, 4],    // TRUSTED + ASSISTANT + GM
      WALL_DOORS:         [1, 2, 3, 4], // PLAYER + TRUSTED + ASSISTANT + GM
    },
  };

  // If OPENAI_API_KEY env var exists, inject it as a setting
  if (process.env.OPENAI_API_KEY) {
    defaults['wy-terminal.openaiApiKey'] = process.env.OPENAI_API_KEY;
    console.log('  ✔  OPENAI_API_KEY detected — auto-populating API key setting');
  }

  // Look up the 'Montero Crew' folder ID to set as default crew filter
  if (foldersDb) {
    for await (const [, value] of foldersDb.iterator()) {
      if (value.type === 'Actor' && value.name === 'Montero Crew') {
        defaults['wy-terminal.crewFolders'] = [value._id];
        console.log(`  ✔  Default crew folder set to Montero Crew (${value._id})`);
        break;
      }
    }
  }

  let setCount = 0;
  for (const [settingKey, settingValue] of Object.entries(defaults)) {
    if (existingKeys.has(settingKey)) continue;

    const id = randomId();
    const doc = {
      key: settingKey,
      value: JSON.stringify(settingValue).replace(/^"|"$/g, '') === settingValue
        ? settingValue
        : JSON.stringify(settingValue),
      _id: id,
      user: null,
      _stats: makeStats(),
    };
    // Settings values in LevelDB are stored as strings in the "value" field
    doc.value = settingValue;
    await settingsDb.put(`!settings!${id}`, doc);
    setCount++;
  }

  console.log(`  ✔  Set ${setCount} default settings (${Object.keys(defaults).length - setCount} already configured)`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(WORLD_DATA)) {
    console.log('  ⚠  World data directory not found — skipping configuration');
    return;
  }

  console.log('── Configuring alienrpg-dev world ──');

  const settingsDb = new ClassicLevel(path.join(WORLD_DATA, 'settings'), { valueEncoding: 'json' });
  const usersDb = new ClassicLevel(path.join(WORLD_DATA, 'users'), { valueEncoding: 'json' });
  const actorsDb = new ClassicLevel(path.join(WORLD_DATA, 'actors'), { valueEncoding: 'json' });
  const foldersDb = new ClassicLevel(path.join(WORLD_DATA, 'folders'), { valueEncoding: 'json' });

  try {
    await enableModule(settingsDb);
    await createPlayerTerminal(usersDb);
    await importCompendiumActors(actorsDb, foldersDb);
    await setDefaultSettings(settingsDb, foldersDb);
  } finally {
    await settingsDb.close();
    await usersDb.close();
    await actorsDb.close();
    await foldersDb.close();
  }

  console.log('── World configuration complete ──');
}

main().catch(e => {
  console.error('  ✖  Configuration failed:', e.message);
  process.exit(1);
});
