/**
 * Extract all pack data from AlienRPG FoundryVTT modules.
 *
 * Reads every LevelDB compendium found under each module's packs/ directory,
 * parses the JSON documents, and writes them out grouped by document type
 * (Actor, Item, JournalEntry, Scene, Macro, RollTable, Adventure, etc.).
 *
 * Output structure:
 *   extracted-world-data/modules/<module-id>/<docType>.json
 *
 * Usage:  node extract-module-packs.mjs
 */

import { ClassicLevel } from 'classic-level';
import { readdir, mkdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';

/* ── Configuration ── */

const MODULES_ROOT = 'C:\\Users\\benthebuilder\\OneDrive\\FoundryVTT\\data\\modules';

const MODULE_IDS = [
  'alienrpg-bbw',
  'alienrpg-cmom',
  'alienrpg-corerules',
  'alienrpg-destroyerofworlds',
  'alienrpg-hod',
  'alienrpg-starterset',
];

const OUTPUT_BASE = join(process.cwd(), 'modules');

/* ── Helpers ── */

async function dirExists(p) {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
}

/**
 * Open a LevelDB, iterate every record, return parsed docs.
 */
async function extractLevelDB(dbPath, label) {
  let db;
  try {
    db = new ClassicLevel(dbPath, { valueEncoding: 'utf8' });
    await db.open({ readOnly: true });
  } catch (err) {
    console.error(`  [SKIP] Cannot open ${label}: ${err.message}`);
    return [];
  }

  const docs = [];
  try {
    for await (const [key, value] of db.iterator()) {
      try {
        docs.push(JSON.parse(value));
      } catch {
        // Non-JSON meta entries (e.g. MANIFEST) — ignore
      }
    }
  } catch (err) {
    console.error(`  [ERR]  Iteration error in ${label}: ${err.message}`);
  }

  await db.close();
  return docs;
}

/**
 * Group an array of Foundry documents by their top-level type field.
 * Falls back to "unknown" when type is missing.
 */
function groupByType(docs) {
  const groups = {};
  for (const doc of docs) {
    const t = doc.type || doc._type || 'unknown';
    (groups[t] ??= []).push(doc);
  }
  return groups;
}

/**
 * Adventure packs wrap everything in a single document with nested arrays.
 * This extracts the nested collections into separate typed arrays.
 */
const ADVENTURE_COLLECTIONS = [
  'actors', 'items', 'scenes', 'journal', 'tables',
  'macros', 'cards', 'playlists', 'combats', 'folders',
];

function flattenAdventures(docs) {
  const flattened = {};
  const adventures = [];

  for (const doc of docs) {
    // Detect Adventure documents: they have nested collection arrays
    const hasCollections = ADVENTURE_COLLECTIONS.some(
      c => Array.isArray(doc[c]) && doc[c].length > 0
    );

    if (!hasCollections) {
      // Regular document — group by type
      const t = doc.type || 'unknown';
      (flattened[t] ??= []).push(doc);
      continue;
    }

    // Store adventure metadata (without the huge nested arrays)
    const meta = { _id: doc._id, name: doc.name, img: doc.img, caption: doc.caption, description: doc.description };
    adventures.push(meta);

    // Extract each nested collection
    for (const coll of ADVENTURE_COLLECTIONS) {
      const arr = doc[coll];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      (flattened[coll] ??= []).push(...arr);
    }
  }

  if (adventures.length > 0) {
    flattened['_adventures'] = adventures;
  }

  return flattened;
}

/* ── Main ── */

async function main() {
  let totalDocs = 0;

  for (const modId of MODULE_IDS) {
    console.log(`\n========== ${modId} ==========`);
    const packsDir = join(MODULES_ROOT, modId, 'packs');

    if (!(await dirExists(packsDir))) {
      console.log('  No packs/ directory — skipping.');
      continue;
    }

    const packFolders = await readdir(packsDir);
    if (packFolders.length === 0) {
      console.log('  packs/ is empty — skipping.');
      continue;
    }

    const allDocs = [];

    for (const folder of packFolders) {
      const dbPath = join(packsDir, folder);
      if (!(await dirExists(dbPath))) continue;

      // Check if it looks like a LevelDB (has CURRENT file or .ldb files)
      const files = await readdir(dbPath);
      const isLevelDB = files.some(f => f === 'CURRENT' || f.endsWith('.ldb'));
      if (!isLevelDB) {
        console.log(`  [SKIP] ${folder} — not a LevelDB`);
        continue;
      }

      console.log(`  Extracting ${folder}...`);
      const docs = await extractLevelDB(dbPath, `${modId}/${folder}`);
      console.log(`    ${docs.length} documents`);
      allDocs.push(...docs);
    }

    if (allDocs.length === 0) {
      console.log('  No documents extracted.');
      continue;
    }

    // Group by document type and write per-type JSON files
    // Adventure packs get flattened into their nested collections
    const groups = flattenAdventures(allDocs);
    const outDir = join(OUTPUT_BASE, modId);
    await mkdir(outDir, { recursive: true });

    // Write all.json with everything
    const allFile = join(outDir, '_all.json');
    await writeFile(allFile, JSON.stringify(allDocs, null, 2));
    console.log(`  Wrote _all.json (${allDocs.length} docs)`);

    // Write per-type files
    let extractedCount = 0;
    for (const [docType, docs] of Object.entries(groups)) {
      const safeName = docType.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const outFile = join(outDir, `${safeName}.json`);
      await writeFile(outFile, JSON.stringify(docs, null, 2));
      extractedCount += docs.length;
      console.log(`  Wrote ${safeName}.json (${docs.length} ${docType})`);
    }

    totalDocs += extractedCount;

    // Print a summary table
    console.log(`  ── Summary: ${extractedCount} documents ──`);
    for (const [docType, docs] of Object.entries(groups)) {
      console.log(`    ${docType}: ${docs.length}`);
      // Show first few names
      const preview = docs.slice(0, 5);
      for (const d of preview) {
        const name = d.name || d.title || d._id || '(unnamed)';
        console.log(`      - ${name}`);
      }
      if (docs.length > 5) console.log(`      ... and ${docs.length - 5} more`);
    }
  }

  console.log(`\n\n=== DONE === ${totalDocs} total documents extracted to ${OUTPUT_BASE}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
