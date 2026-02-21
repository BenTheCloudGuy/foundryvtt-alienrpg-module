/**
 * Extract FoundryVTT v13 world data from LevelDB databases
 * Reads each data type and exports as JSON files
 */
import { ClassicLevel } from 'classic-level';
import { readdir, mkdir, writeFile, copyFile, stat } from 'fs/promises';
import { join, basename } from 'path';

const WORLD_PATH = 'C:\\Users\\benthebuilder\\OneDrive\\FoundryVTT\\data\\worlds\\alienrpg';
const FOUNDRY_DATA = 'C:\\Users\\benthebuilder\\OneDrive\\FoundryVTT\\data';
const OUTPUT_DIR = join(process.cwd(), 'extracted-world-data');

// Data types to extract
const DATA_TYPES = ['actors', 'items', 'scenes', 'macros', 'journal', 'tables', 'playlists', 'cards', 'folders'];

async function extractDB(dbPath, typeName) {
  console.log(`\n--- Extracting: ${typeName} from ${dbPath} ---`);
  
  let db;
  try {
    db = new ClassicLevel(dbPath, { valueEncoding: 'utf8' });
    await db.open({ readOnly: true });
  } catch (err) {
    console.error(`  Failed to open ${typeName}: ${err.message}`);
    return [];
  }

  const records = [];
  try {
    for await (const [key, value] of db.iterator()) {
      try {
        const doc = JSON.parse(value);
        records.push({ key: key.toString(), doc });
      } catch (parseErr) {
        // Some entries may not be JSON
        records.push({ key: key.toString(), raw: value.toString().substring(0, 200) });
      }
    }
  } catch (iterErr) {
    console.error(`  Error iterating ${typeName}: ${iterErr.message}`);
  }

  await db.close();
  console.log(`  Found ${records.length} records in ${typeName}`);
  return records;
}

async function main() {
  // Create output directory
  await mkdir(OUTPUT_DIR, { recursive: true });

  const summary = {};

  for (const type of DATA_TYPES) {
    const dbPath = join(WORLD_PATH, 'data', type);
    
    try {
      await stat(dbPath);
    } catch {
      console.log(`Skipping ${type} - directory not found`);
      continue;
    }

    const records = await extractDB(dbPath, type);
    summary[type] = records.length;

    if (records.length > 0) {
      // Write full data
      const outFile = join(OUTPUT_DIR, `${type}.json`);
      await writeFile(outFile, JSON.stringify(records, null, 2));
      console.log(`  Wrote ${outFile}`);

      // Print summary of each record
      for (const rec of records) {
        if (rec.doc) {
          const name = rec.doc.name || rec.doc._id || rec.key;
          const docType = rec.doc.type || '';
          console.log(`    - ${name} ${docType ? `(${docType})` : ''}`);
          
          // For scenes, show image paths
          if (type === 'scenes' && rec.doc.background) {
            console.log(`      background: ${JSON.stringify(rec.doc.background)}`);
          }
          if (type === 'scenes' && rec.doc.img) {
            console.log(`      img: ${rec.doc.img}`);
          }
        }
      }
    }
  }

  console.log('\n\n=== EXTRACTION SUMMARY ===');
  for (const [type, count] of Object.entries(summary)) {
    console.log(`  ${type}: ${count} records`);
  }
  console.log(`\nData written to: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
