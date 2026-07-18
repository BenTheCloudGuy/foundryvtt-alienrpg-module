# Weyland-Yutani Ship Terminal — Project Guidelines

A FoundryVTT **v13** module (`id: wy-terminal`) for the **AlienRPG (Alien Evolved) v4.0.0+** system. It turns a second screen/tablet into an interactive green-screen shipboard computer terminal with real-time socket sync, a MU/TH/UR AI chat engine, digital maps, and Foundry scene rendering. See [README.md](../README.md) for feature overview and [CHANGELOG.md](../CHANGELOG.md) for release history.

## Architecture

The module is plain browser-native ES modules — **no bundler, no build step for runtime code**. Files are loaded directly by Foundry from `module.json`.

- Entry point: [scripts/wy-terminal.mjs](../scripts/wy-terminal.mjs) — registers `init`/`ready` hooks, exposes the `game.wyTerminal` API, and puts player clients into full-screen terminal mode while the GM gets a pop-out.
- [scripts/terminal-app.mjs](../scripts/terminal-app.mjs) — `WYTerminalApp` (extends Foundry `Application`), the main window; owns view navigation, pinch-zoom, scene rendering, and chat.
- [scripts/muthur-engine.mjs](../scripts/muthur-engine.mjs) — `MuthurEngine`, the browser-side AI engine (OpenAI-compatible `fetch`); builds scenario system prompts from `muthur/` assets.
- [scripts/muthur-bridge.mjs](../scripts/muthur-bridge.mjs) — `MuthurBridge`, routes queries through ENGINE, IFRAME, or GM-RELAY mode.
- [scripts/ship-profiles.mjs](../scripts/ship-profiles.mjs) — `SHIP_PROFILES` static definitions (identity, default systems/crew, UI theme).
- [scripts/ship-status.mjs](../scripts/ship-status.mjs), [scripts/settings.mjs](../scripts/settings.mjs), [scripts/terminal-sounds.mjs](../scripts/terminal-sounds.mjs), [scripts/pinch-zoom.mjs](../scripts/pinch-zoom.mjs) — supporting managers/helpers.

### Data flow

- **Real-time sync** uses Foundry sockets (`socket: true` in `module.json`). GM commands and MU/TH/UR responses are broadcast to player terminals; socket payloads include `userId` so per-user state (clearance, command codes) targets the right client.
- **Clearance is per-user**, not global (see CHANGELOG v1.1.0). Never reintroduce shared/global clearance. Gate content with `_canAccessClassification()` against the requesting user's clearance.
- **Views** live in [templates/views/](../templates/views/) as Handlebars `.hbs` files, wrapped by [templates/terminal.hbs](../templates/terminal.hbs). New views must be added to the `loadTemplates([...])` list in `wy-terminal.mjs`.
- **MU/TH/UR scenario content** is static assets under `muthur/` — `plugins/<name>/`, `prompts/`, `config.json`, `logs-*.json`, `starsystems.json`. Plugins are registered in `PLUGIN_REGISTRY` in `muthur-engine.mjs`.

## Conventions

- Runtime code is `.mjs` ES modules with `import`/`export`. All in-module asset paths are absolute Foundry paths: `modules/wy-terminal/...` (e.g. `modules/wy-terminal/templates/views/nav.hbs`). Do not use relative paths for Foundry-loaded assets.
- Every file starts with a `/** ... */` JSDoc block describing its purpose. Class fields use `/** @type {...} */` JSDoc annotations. Match this style.
- Terminal UI text is **UPPERCASE** with a green-phosphor CRT aesthetic; styling lives in [styles/terminal.css](../styles/terminal.css) using `wy-` prefixed classes (e.g. `wy-text-green`).
- Console logging is prefixed `WY-Terminal | ...`.
- Guard Foundry API access that may run before settings are registered with try/catch (see the `defaultOptions` and game-clock anchor patterns).
- New settings go in `registerSettings()` in `settings.mjs` under the `wy-terminal` namespace; use `config: false` for anything managed from the in-terminal CONFIG view.
- FoundryVTT v13 API shapes vary (arrays vs Map vs object) — defensively handle multiple shapes, as done in the `getSceneControlButtons` hook.

## Local Dev Environment

Development runs against a locally installed FoundryVTT instance on a **Windows** host (PowerShell/`pwsh`):

- **Hostname:** http://localhost:30000
- **FoundryVTT dir:** `C:\Users\bemitchell\OneDrive\FoundryVTT`
- **Data dir:** `C:\Users\bemitchell\OneDrive\FoundryVTT\data`
- **Module dir (deploy target):** `C:\Users\bemitchell\OneDrive\FoundryVTT\data\modules\wy-terminal`

This repo is **not** the folder Foundry loads — the module dir above is. To test changes in real time, replicate runtime assets (module.json, scripts, styles, templates, lang, images, muthur, media, packs, status) into the module dir. **Node.js is not assumed to be on PATH on the Windows host**, so the primary sync is a Node-free PowerShell script driven by `robocopy`:

- **Primary (Windows, no Node):** run the VS Code task **WYT: Sync to Foundry** (one-shot) or **WYT: Watch and Sync to Foundry** (continuous). Equivalently: `pwsh -File dev/sync-to-foundry.ps1 [-Watch]`. See [dev/sync-to-foundry.ps1](../dev/sync-to-foundry.ps1).
- **Alternative (only if Node is installed / in the Linux devcontainer):** `npm run sync` / `npm run watch` ([dev/sync-to-foundry.mjs](../dev/sync-to-foundry.mjs)).
- Override the target with the `WYT_FOUNDRY_MODULE_DIR` environment variable.

**After editing any runtime file, ensure it is synced** (the watch task handles this automatically), then reload the Foundry client (F5) to load the changes. Only reload; no server restart is needed for module code/asset changes.

The [.vscode/mcp.json](../.vscode/mcp.json) `foundry-data` filesystem MCP server exposes the deployed module dir, worlds, and Foundry logs read/write for inspecting the live deployment and debugging.

## Compendium Packs (build step)

Actors are authored as raw JSON in [compendium-src/wyt-cog-actors/](../compendium-src/) (subfolders `montero/`, `cronus/`, `sotillo/`, `creatures/`) and compiled into a LevelDB pack under `packs/`.

- Build with `npm run build-packs` (runs [compendium-src/build-packs.mjs](../compendium-src/build-packs.mjs), uses `classic-level`).
- Each subfolder becomes a Foundry Folder; pack/folder IDs and metadata are defined in the `PACKS` array in `build-packs.mjs`.
- Actor JSON must be valid for the AlienRPG system schema. Reference source data lives in [extracted-world-data/](../extracted-world-data/).
- **Do not hand-edit files in `packs/`** (LevelDB `.ldb`/`LOG`/`MANIFEST`); edit the source JSON and rebuild.

## Validation

- After changing actor JSON, run `npm run build-packs` and confirm it completes without errors before considering the work done.
- When adding a new actor, compare every property against an existing actor of the same type in the same folder to catch missing/mismatched fields in one pass.
- There is no automated test suite; validate module code by loading it in FoundryVTT v13. Do not add build tooling or bundlers unless asked.

## Safety

- Never commit API keys. `muthur/config.json` and the module settings hold `openai_api_key` — keep them blank in source.
- This is an unofficial fan project; keep that framing. Do not add affiliation claims to Free League or 20th Century Studios.
