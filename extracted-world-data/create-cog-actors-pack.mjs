/**
 * Build WYT-COG-ACTORS compendium pack.
 *
 * Reads actors.json, picks only the Chariot of the Gods actors,
 * reassigns them into four folders (USCSS MONTERO, USCSS CRONUS,
 * SOTILLO, CREATURES), and writes a clean LevelDB pack.
 */
import { ClassicLevel } from 'classic-level';
import { readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

const ACTORS_JSON = join(import.meta.dirname, 'actors.json');
const PACK_DIR = join(import.meta.dirname, '..', 'foundryvtt-alienrpg-module', 'packs', 'wyt-cog-actors');

// Generate a Foundry-style 16-char random ID
function fvttId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(16);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

// ---------- folder IDs (new, deterministic for reproducibility) ----------
const FOLDER_IDS = {
  MONTERO:   'WYTcogMontero01',
  CRONUS:    'WYTcogCronus001',
  SOTILLO:   'WYTcogSotillo01',
  CREATURES: 'WYTcogCreature1',
};

// ---------- actor assignments ----------
// Montero crew (original folder: v5ochSwdWr8xFVto)
const MONTERO_IDS = new Set([
  '9I9qoDd7M4UFnoTh', // Leah Davis
  'e1VqKvdCzYst5aAL', // Vanessa Miller
  'h5czTg41nP5UKvkh', // John J. Wilson
  'i9OEr43wPyTavZpO', // Kayla Rye
  'o2SRHA7NgeXl3HKR', // Lyron Cham
]);

// Cronus crew (subset of original folder cs2JnCLDPQdwJAle)
const CRONUS_IDS = new Set([
  '01uC5a0rBt0pQK7Q', // Liam Flynn
  'l8mRuUzkPNOGJ0ea', // Ava 6
  'tyGU7CLiouodl2lI', // Albert Johns
  'xtdf3EWe6qoeKP1K', // Daniel Cooper
  'xvOZLgfHrMciNsx7', // Lori Clayton
  'ysMYLfbQItexH0zY', // Valerie Reid
]);

// Sotillo crew (subset of original folder cs2JnCLDPQdwJAle)
const SOTILLO_IDS = new Set([
  '0ZKya7cuhLLl2Dk4', // Micky Horton
  '1jiwbs4wSQgMXxrJ', // Adisa Bolaji
  'H6cjx2mO6ZgXODim', // Pinion
  'ICoiZSt3MOdtEoK6', // Helen Bein
]);

// Creatures (original folder: VGNmXUSgLmAEsqNY)
const CREATURE_IDS = new Set([
  '4kx0T1FiU82P7hUi', // Mutant (Stage II)
  '8bKMgC0BCh5HcHTg', // Neomorphic Bloodburster (Stage III Neomorph)
  '93j15hcp07XSsaeX', // Infected (Stage I)
  'HCSqei1D99ILv6hX', // Neomorph (Stage IV Neophyte)
  'byM1v7P0at6ZuxVn', // Revenant (Stage III)
  'jMgwimif6dmQ1jlu', // Neomorphic Motes (Stage II Neomorph)
  'q21IlVDSzROAp11K', // Adult (Stage V Neomorph)
  'vPyngsIYOcWJvGSa', // Egg Sacs (Stage I Neomorph)
  'wuHrXc5txMIJZ9py', // Beluga-Head (Stage IV)
]);

// All IDs we care about
const ALL_IDS = new Set([...MONTERO_IDS, ...CRONUS_IDS, ...SOTILLO_IDS, ...CREATURE_IDS]);

function assignFolder(id) {
  if (MONTERO_IDS.has(id))   return FOLDER_IDS.MONTERO;
  if (CRONUS_IDS.has(id))    return FOLDER_IDS.CRONUS;
  if (SOTILLO_IDS.has(id))   return FOLDER_IDS.SOTILLO;
  if (CREATURE_IDS.has(id))  return FOLDER_IDS.CREATURES;
  return null;
}

// ---------- Foundry folder documents ----------
function buildFolderDocs() {
  return [
    {
      _id: FOLDER_IDS.MONTERO,
      name: 'USCSS MONTERO',
      type: 'Actor',
      sort: 100000,
      color: '#00ff00',
      flags: {},
      folder: null,
      sorting: 'a',
      _stats: { compendiumSource: null, duplicateSource: null, coreVersion: '13', modifiedTime: Date.now() },
    },
    {
      _id: FOLDER_IDS.CRONUS,
      name: 'USCSS CRONUS',
      type: 'Actor',
      sort: 200000,
      color: '#00ff00',
      flags: {},
      folder: null,
      sorting: 'a',
      _stats: { compendiumSource: null, duplicateSource: null, coreVersion: '13', modifiedTime: Date.now() },
    },
    {
      _id: FOLDER_IDS.SOTILLO,
      name: 'SOTILLO',
      type: 'Actor',
      sort: 300000,
      color: '#00ff00',
      flags: {},
      folder: null,
      sorting: 'a',
      _stats: { compendiumSource: null, duplicateSource: null, coreVersion: '13', modifiedTime: Date.now() },
    },
    {
      _id: FOLDER_IDS.CREATURES,
      name: 'CREATURES',
      type: 'Actor',
      sort: 400000,
      color: '#ff4400',
      flags: {},
      folder: null,
      sorting: 'a',
      _stats: { compendiumSource: null, duplicateSource: null, coreVersion: '13', modifiedTime: Date.now() },
    },
  ];
}

async function main() {
  console.log('=== Building WYT-COG-ACTORS compendium pack ===\n');

  // Read source data
  const raw = await readFile(ACTORS_JSON, 'utf8');
  const allEntries = JSON.parse(raw);

  // Filter to only the CoG actors
  const cogActors = allEntries.filter(entry => entry.doc && ALL_IDS.has(entry.doc._id));
  console.log(`Found ${cogActors.length} / ${ALL_IDS.size} CoG actors in actors.json`);

  if (cogActors.length !== ALL_IDS.size) {
    const found = new Set(cogActors.map(a => a.doc._id));
    for (const id of ALL_IDS) {
      if (!found.has(id)) console.warn(`  MISSING: ${id}`);
    }
  }

  // Clean and create pack directory
  try { await rm(PACK_DIR, { recursive: true, force: true }); } catch {}
  await mkdir(PACK_DIR, { recursive: true });

  // Open LevelDB
  const db = new ClassicLevel(PACK_DIR, { valueEncoding: 'utf8' });
  await db.open();
  const batch = db.batch();

  // Write folder documents
  const folders = buildFolderDocs();
  for (const folder of folders) {
    const key = `!folders!${folder._id}`;
    batch.put(key, JSON.stringify(folder));
    console.log(`  Folder: ${folder.name} (${folder._id})`);
  }

  // Write actor documents with reassigned folders
  let counts = { MONTERO: 0, CRONUS: 0, SOTILLO: 0, CREATURES: 0 };
  for (const entry of cogActors) {
    const doc = { ...entry.doc };
    const newFolder = assignFolder(doc._id);
    doc.folder = newFolder;

    const key = `!actors!${doc._id}`;
    batch.put(key, JSON.stringify(doc));

    const ship = MONTERO_IDS.has(doc._id) ? 'MONTERO'
               : CRONUS_IDS.has(doc._id) ? 'CRONUS'
               : SOTILLO_IDS.has(doc._id) ? 'SOTILLO'
               : 'CREATURES';
    counts[ship]++;
    console.log(`  ${ship.padEnd(10)} ${doc.name}`);
  }

  await batch.write();
  await db.close();

  console.log('\n=== Summary ===');
  console.log(`  USCSS MONTERO: ${counts.MONTERO} actors`);
  console.log(`  USCSS CRONUS:  ${counts.CRONUS} actors`);
  console.log(`  SOTILLO:       ${counts.SOTILLO} actors`);
  console.log(`  CREATURES:     ${counts.CREATURES} actors`);
  console.log(`  Total:         ${cogActors.length} actors + ${folders.length} folders`);
  console.log(`\nPack written to: ${PACK_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
