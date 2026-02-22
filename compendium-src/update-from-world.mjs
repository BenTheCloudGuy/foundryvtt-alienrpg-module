/**
 * update-from-world.mjs — Export current world actors into compendium-src JSON
 *
 * Reads extracted-world-data/actors.json (exported from FoundryVTT world),
 * matches character/synthetic actors to their folder (Montero, Cronus, Sotillo),
 * and writes updated JSON files into compendium-src/wyt-cog-actors/<folder>/.
 *
 * Usage:
 *   node compendium-src/update-from-world.mjs
 *   (then run: node compendium-src/build-packs.mjs to rebuild LevelDB)
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WORLD_ACTORS = join(ROOT, 'extracted-world-data', 'actors.json');
const DEST_DIR = join(__dirname, 'wyt-cog-actors');

// Map world folder IDs/names to compendium subfolder names.
// These are matched by checking the folder name from extracted world data.
const FOLDER_MAP = {
  montero: ['montero'],
  cronus: ['cronus'],
  sotillo: ['sotillo'],
};

// Folder data from extracted world
let worldFolders = {};

function classifyActor(actor) {
  // Classify by appearance text (contains ship name) since world folders
  // are "CotG PC's" / "CotG NPC's", not ship-based.
  const appearance = (actor.system?.general?.appearance?.value || '').toLowerCase();

  if (appearance.includes('montero')) return 'montero';
  if (appearance.includes('cronus')) return 'cronus';
  if (appearance.includes('sotillo')) return 'sotillo';

  return null;
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function main() {
  console.log('=== Update Compendium Source from World Data ===\n');

  // Load world actors
  const raw = await readFile(WORLD_ACTORS, 'utf8');
  const allEntries = JSON.parse(raw);

  // Load world folders
  const foldersRaw = await readFile(join(ROOT, 'extracted-world-data', 'folders.json'), 'utf8');
  const foldersArr = JSON.parse(foldersRaw);
  const folders = {};
  for (const entry of foldersArr) {
    const doc = entry.doc || entry;
    folders[doc._id] = doc;
  }

  console.log(`Loaded ${allEntries.length} world entries, ${Object.keys(folders).length} folders.\n`);

  let updated = 0;
  let skipped = 0;

  for (const entry of allEntries) {
    const actor = entry.doc || entry;

    // Only process character and synthetic actors
    if (actor.type !== 'character' && actor.type !== 'synthetic') {
      continue;
    }

    const subdir = classifyActor(actor);
    if (!subdir) {
      console.log(`  SKIP  ${actor.name} — folder not mapped`);
      skipped++;
      continue;
    }

    const destDir = join(DEST_DIR, subdir);
    await mkdir(destDir, { recursive: true });

    const filename = sanitizeFilename(actor.name) + '.json';
    const destFile = join(destDir, filename);

    // Write the full actor document (pretty-printed)
    await writeFile(destFile, JSON.stringify(actor, null, 2) + '\n', 'utf8');
    console.log(`  WRITE ${subdir.padEnd(10)} ${actor.name} → ${filename}`);
    updated++;
  }

  console.log(`\n=== Done: ${updated} actors written, ${skipped} skipped ===`);
  console.log('Next step: run "node compendium-src/build-packs.mjs" to rebuild the LevelDB pack.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
