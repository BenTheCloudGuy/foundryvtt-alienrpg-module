#!/usr/bin/env node
/**
 * import-new-cronus-actors.mjs
 *
 * Imports the 25 new dead/missing Cronus crew actors into the running
 * alienrpg-dev world's LevelDB. Must run while FoundryVTT is STOPPED.
 *
 * Steps:
 *   1. Opens the world's actors & folders databases
 *   2. Finds the existing "Cronus Crew" folder ID
 *   3. Reads actor JSON files from compendium-src/wyt-cog-actors/cronus/
 *   4. Skips any actor whose name already exists in the world
 *   5. Writes new actors into the actors DB
 */
import { ClassicLevel } from 'classic-level';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.join(process.env.HOME, 'foundrydata');
const WORLD_DATA = path.join(DATA_DIR, 'Data', 'worlds', 'alienrpg-dev', 'data');
const SRC_DIR = path.join('/workspaces/foundryvtt-alienrpg-module/compendium-src/wyt-cog-actors/cronus');

function randomId(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

const NOW = Date.now();

async function main() {
  console.log('── Import New Cronus Actors ──');

  const actorsDb = new ClassicLevel(path.join(WORLD_DATA, 'actors'), { valueEncoding: 'json' });
  const foldersDb = new ClassicLevel(path.join(WORLD_DATA, 'folders'), { valueEncoding: 'json' });

  try {
    // 1. Find existing "Cronus Crew" folder ID
    let cronusFolderId = null;
    for await (const [, value] of foldersDb.iterator()) {
      if (value.type === 'Actor' && value.name === 'Cronus Crew') {
        cronusFolderId = value._id;
        break;
      }
    }

    if (!cronusFolderId) {
      console.log('  ⚠  "Cronus Crew" folder not found — creating one');
      cronusFolderId = randomId();
      const folder = {
        name: 'Cronus Crew',
        type: 'Actor',
        _id: cronusFolderId,
        description: '',
        sorting: 'a',
        sort: 0,
        color: '#28cc72',
        flags: {},
        folder: null,
        _stats: {
          coreVersion: '13.351', systemId: 'alienrpg', systemVersion: '4.0.0',
          createdTime: NOW, modifiedTime: NOW, lastModifiedBy: null,
          compendiumSource: null, duplicateSource: null, exportSource: null,
        },
      };
      await foldersDb.put(`!folders!${cronusFolderId}`, folder);
    }

    console.log(`  ✔  Cronus Crew folder: ${cronusFolderId}`);

    // 2. Collect existing actor names to avoid duplicates
    const existingNames = new Set();
    for await (const [, value] of actorsDb.iterator()) {
      existingNames.add((value.name || '').toUpperCase());
    }
    console.log(`  ℹ  ${existingNames.size} actors already in world`);

    // 3. Read all JSON files from source directory
    const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.json')).sort();
    let imported = 0;
    let skipped = 0;

    const batch = actorsDb.batch();

    for (const file of files) {
      const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf-8');
      const actor = JSON.parse(raw);

      if (existingNames.has((actor.name || '').toUpperCase())) {
        skipped++;
        continue;
      }

      // Assign new ID and folder
      const origId = actor._id;
      const newId = randomId();
      actor._id = newId;
      actor.folder = cronusFolderId;
      actor._stats = {
        coreVersion: '13.351', systemId: 'alienrpg', systemVersion: '4.0.10',
        createdTime: NOW, modifiedTime: NOW, lastModifiedBy: null,
        compendiumSource: `Compendium.wy-terminal.wyt-cog-actors.Actor.${origId}`,
        duplicateSource: null, exportSource: null,
      };
      actor.ownership = { default: 0 };

      batch.put(`!actors!${newId}`, actor);
      imported++;
      console.log(`  +  ${actor.name}`);
    }

    await batch.write();

    console.log(`\n  ✔  Imported ${imported} actors, skipped ${skipped} (already exist)`);
    console.log('── Done ──');

  } finally {
    await actorsDb.close();
    await foldersDb.close();
  }
}

main().catch(e => {
  console.error('  ✖  Failed:', e.message);
  process.exit(1);
});
