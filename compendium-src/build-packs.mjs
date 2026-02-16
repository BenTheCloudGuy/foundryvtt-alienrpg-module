/**
 * build-packs.mjs - Compendium Pack Builder
 *
 * Reads raw JSON actor files from compendium-src/ and writes them into
 * LevelDB compendium packs under packs/.
 *
 * Usage:
 *   npm run build-packs
 *   node compendium-src/build-packs.mjs
 *
 * Directory layout:
 *   compendium-src/
 *     build-packs.mjs          <-- this script
 *     wyt-cog-actors/
 *       montero/               <-- USCSS MONTERO crew
 *         vanessa_miller.json
 *         ...
 *       cronus/                <-- USCSS CRONUS crew
 *         daniel_cooper.json
 *         ...
 *       sotillo/               <-- SOTILLO crew
 *         adisa_bolaji.json
 *         ...
 *       creatures/             <-- CoG creatures
 *         infected__stage_i_.json
 *         ...
 *
 * Each subfolder becomes a Folder document inside the compendium pack.
 * To add or remove actors, just add/delete JSON files and re-run.
 */
import { ClassicLevel } from 'classic-level';
import { readdir, readFile, mkdir, rm, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = __dirname;
const PACKS_DIR = join(__dirname, '..', 'packs');

// Pack definitions -- each key is a folder under compendium-src/
// that contains subfolders with JSON source files.
const PACKS = [
  {
    name: 'wyt-cog-actors',
    type: 'Actor',
    folders: {
      montero:   { label: 'USCSS MONTERO', id: 'sMyiKZWcTYqqv9Vs', sort: 100000, color: '#00ff00' },
      cronus:    { label: 'USCSS CRONUS',  id: '4gEPubn02pdPtghw', sort: 200000, color: '#00ff00' },
      sotillo:   { label: 'SOTILLO',       id: 'B098wS4t8U2vOhdX', sort: 300000, color: '#00ff00' },
      creatures: { label: 'CREATURES',     id: 'GN4j3th5iYZLSwbd', sort: 400000, color: '#ff4400' },
    },
  },
  // Add more packs here as needed, e.g.:
  // {
  //   name: 'wyt-cog-items',
  //   type: 'Item',
  //   folders: { ... },
  // },
];

async function dirExists(p) {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
}

async function buildPack(pack) {
  const srcPath = join(SRC_DIR, pack.name);
  const destPath = join(PACKS_DIR, pack.name);

  if (!await dirExists(srcPath)) {
    console.log(`  SKIP ${pack.name} -- source directory not found at ${srcPath}`);
    return;
  }

  console.log(`\n--- ${pack.name} ---`);

  // Clean and create destination
  try { await rm(destPath, { recursive: true, force: true }); } catch {}
  await mkdir(destPath, { recursive: true });

  // Open LevelDB
  const db = new ClassicLevel(destPath, { valueEncoding: 'utf8' });
  await db.open();
  const batch = db.batch();

  let actorCount = 0;
  let folderCount = 0;

  // Process each subfolder
  for (const [dirName, folderMeta] of Object.entries(pack.folders)) {
    const folderPath = join(srcPath, dirName);
    if (!await dirExists(folderPath)) {
      console.log(`  SKIP folder ${dirName} -- not found`);
      continue;
    }

    // Write the Folder document
    const folderDoc = {
      _id: folderMeta.id,
      name: folderMeta.label,
      type: pack.type,
      sort: folderMeta.sort,
      color: folderMeta.color,
      flags: {},
      folder: null,
      sorting: 'a',
      _stats: {
        compendiumSource: null,
        duplicateSource: null,
        coreVersion: '13',
        modifiedTime: Date.now(),
      },
    };
    batch.put(`!folders!${folderMeta.id}`, JSON.stringify(folderDoc));
    folderCount++;

    // Read all JSON files in this subfolder
    const files = (await readdir(folderPath)).filter(f => f.endsWith('.json')).sort();

    for (const file of files) {
      const raw = await readFile(join(folderPath, file), 'utf8');
      const doc = JSON.parse(raw);

      // Reassign folder to our compendium folder ID
      doc.folder = folderMeta.id;

      const key = `!actors!${doc._id}`;
      batch.put(key, JSON.stringify(doc));
      actorCount++;
      console.log(`  ${folderMeta.label.padEnd(16)} ${doc.name}`);
    }
  }

  await batch.write();
  await db.close();

  console.log(`  -- ${actorCount} actors, ${folderCount} folders written to ${destPath}`);
  return { actors: actorCount, folders: folderCount };
}

async function main() {
  console.log('=== Compendium Pack Builder ===');
  console.log(`Source:  ${SRC_DIR}`);
  console.log(`Output:  ${PACKS_DIR}`);

  const results = {};
  for (const pack of PACKS) {
    results[pack.name] = await buildPack(pack);
  }

  console.log('\n=== Done ===');
  for (const [name, r] of Object.entries(results)) {
    if (r) console.log(`  ${name}: ${r.actors} actors, ${r.folders} folders`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
