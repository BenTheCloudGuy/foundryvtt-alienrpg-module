/**
 * Create FoundryVTT module compendium packs from world LevelDB data.
 * Copies the LevelDB databases from the world directly into clean module packs,
 * creating new LevelDB databases with only the relevant records.
 */
import { ClassicLevel } from 'classic-level';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';

const WORLD_DATA = 'C:\\Users\\benthebuilder\\OneDrive\\FoundryVTT\\data\\worlds\\alienrpg\\data';
const MODULE_PACKS = 'C:\\Users\\benthebuilder\\.working\\gaming\\terminal\\foundryvtt-alienrpg-module\\packs';

// Pack definitions: source LevelDB dir name → pack config
const PACKS = [
  { name: 'actors',   label: 'AlienRPG Actors',    type: 'Actor',        source: 'actors' },
  { name: 'items',    label: 'AlienRPG Items',      type: 'Item',         source: 'items' },
  { name: 'scenes',   label: 'AlienRPG Scenes',     type: 'Scene',        source: 'scenes' },
  { name: 'macros',   label: 'AlienRPG Macros',     type: 'Macro',        source: 'macros' },
  { name: 'journal',  label: 'AlienRPG Journal',    type: 'JournalEntry', source: 'journal' },
  { name: 'tables',   label: 'AlienRPG Tables',     type: 'RollTable',    source: 'tables' },
];

async function copyLevelDB(srcPath, destPath, packName) {
  console.log(`\nCopying ${packName}: ${srcPath} → ${destPath}`);

  // Open source DB (read-only)
  const srcDB = new ClassicLevel(srcPath, { valueEncoding: 'utf8' });
  await srcDB.open({ readOnly: true });

  // Create destination DB
  await mkdir(destPath, { recursive: true });
  const destDB = new ClassicLevel(destPath, { valueEncoding: 'utf8' });
  await destDB.open();

  let count = 0;
  const batch = destDB.batch();

  for await (const [key, value] of srcDB.iterator()) {
    batch.put(key, value);
    count++;
  }

  await batch.write();
  await srcDB.close();
  await destDB.close();

  console.log(`  ✓ Copied ${count} records to ${packName}`);
  return count;
}

async function main() {
  console.log('=== Creating Module Compendium Packs ===\n');

  // Clean and create packs directory
  try {
    await rm(MODULE_PACKS, { recursive: true, force: true });
  } catch {}
  await mkdir(MODULE_PACKS, { recursive: true });

  const results = {};

  for (const pack of PACKS) {
    const srcPath = join(WORLD_DATA, pack.source);
    const destPath = join(MODULE_PACKS, pack.name);

    try {
      const count = await copyLevelDB(srcPath, destPath, pack.name);
      results[pack.name] = count;
    } catch (err) {
      console.error(`  ✗ Failed to copy ${pack.name}: ${err.message}`);
      results[pack.name] = 0;
    }
  }

  // Also copy folders into each relevant pack (optional — Foundry v13 handles this)
  // Folders are organizational and can be included separately

  console.log('\n=== Pack Creation Summary ===');
  for (const [name, count] of Object.entries(results)) {
    console.log(`  ${name}: ${count} records`);
  }

  // Generate module.json packs config
  console.log('\n=== module.json packs configuration ===');
  const packsConfig = PACKS.map(p => ({
    name: p.name,
    label: p.label,
    path: `packs/${p.name}`,
    type: p.type,
    system: 'alienrpg',
    ownership: { PLAYER: 'OBSERVER', ASSISTANT: 'OWNER' }
  }));
  console.log(JSON.stringify(packsConfig, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
