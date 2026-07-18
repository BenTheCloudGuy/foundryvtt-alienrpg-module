/**
 * sync-to-foundry.mjs — Dev-loop file replication for the Weyland-Yutani Ship Terminal.
 *
 * Mirrors the module's runtime assets from this repo into the locally installed
 * FoundryVTT module directory so code changes can be tested in real time.
 * Reload the Foundry client (F5) after a sync to pick up the changes.
 *
 * Usage:
 *   npm run sync             # one-shot mirror
 *   npm run watch            # mirror once, then re-sync on every change
 *   node dev/sync-to-foundry.mjs [--watch]
 *
 * Target directory resolution (first match wins):
 *   1. WYT_FOUNDRY_MODULE_DIR environment variable
 *   2. DEFAULT_MODULE_DIR below
 *
 * Only runtime assets referenced by module.json are copied. Dev-only folders
 * (.git, node_modules, compendium-src, extracted-world-data, docs, etc.) are
 * never synced.
 */
import { cp, mkdir, rm, stat, watch } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

/** Default install path — override with WYT_FOUNDRY_MODULE_DIR. */
const DEFAULT_MODULE_DIR = 'C:\\Users\\bemitchell\\OneDrive\\FoundryVTT\\data\\modules\\wy-terminal';

const TARGET_DIR = process.env.WYT_FOUNDRY_MODULE_DIR || DEFAULT_MODULE_DIR;

/** Runtime assets Foundry loads. Files and directories are mirrored as-is. */
const RUNTIME_ASSETS = [
  'module.json',
  'scripts',
  'styles',
  'templates',
  'lang',
  'images',
  'muthur',
  'media',
  'packs',
  'status',
];

const WATCH = process.argv.includes('--watch');
const LOG = (msg) => console.log(`WY-Sync | ${msg}`);

/** Copy a single asset (file or directory) into the target module dir. */
async function syncAsset(name) {
  const src = join(REPO_ROOT, name);
  if (!existsSync(src)) return; // asset not present — skip silently
  const dest = join(TARGET_DIR, name);
  const info = await stat(src);
  if (info.isDirectory()) {
    await rm(dest, { recursive: true, force: true });
    await cp(src, dest, { recursive: true });
  } else {
    await mkdir(dirname(dest), { recursive: true });
    await cp(src, dest);
  }
}

/** Mirror every runtime asset into the target module dir. */
async function syncAll() {
  await mkdir(TARGET_DIR, { recursive: true });
  for (const name of RUNTIME_ASSETS) {
    await syncAsset(name);
  }
  LOG(`Synced ${RUNTIME_ASSETS.length} asset groups → ${TARGET_DIR}`);
}

/** Watch runtime asset roots and re-sync the changed top-level group. */
async function watchAll() {
  LOG('Watching for changes — press Ctrl+C to stop.');
  for (const name of RUNTIME_ASSETS) {
    const src = join(REPO_ROOT, name);
    if (!existsSync(src)) continue;
    (async () => {
      try {
        const watcher = watch(src, { recursive: true });
        for await (const _event of watcher) {
          try {
            await syncAsset(name);
            LOG(`Re-synced ${name}`);
          } catch (err) {
            LOG(`ERROR re-syncing ${name}: ${err.message}`);
          }
        }
      } catch (err) {
        LOG(`ERROR watching ${name}: ${err.message}`);
      }
    })();
  }
}

await syncAll();
if (WATCH) {
  await watchAll();
  // Keep the process alive for the watchers.
  await new Promise(() => {});
}
