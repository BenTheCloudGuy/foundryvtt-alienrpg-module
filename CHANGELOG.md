# Changelog



## v1.0.7 — 2026-02-17

### GM Controls — AI Provider Setup

- Added AI PROVIDER SETUP info box to the in-terminal GM Settings view with Option A (OpenAI cloud) and Option B (Local Ollama) instructions.
- Added API Base URL field to the in-terminal GM Controls so the GM can configure the endpoint without leaving the terminal.
- Updated hint text for API Base URL and API Key settings to reference Ollama.

### Local AI Container

- Setup LocalAI Docker solution in the module directory `local-ai/`.
- Final stack: Ollama (:11434) + Whisper STT (:9000), 2 services.

### Documentation

- Updated README.md Requirements section to list both OpenAI and Ollama as AI provider options.
- Expanded MU/TH/UR AI Setup section with Option A (OpenAI), Option B (Ollama), and No AI Configured (GM Relay) paths.
- Updated `local-ai/README.md` Quick Start path from `cd LocalAIContainer` to `cd local-ai`.

### GM Controls — Reset Game Settings

- Replaced single "Reset Logs to Defaults" button with a RESET GAME SETTINGS section containing 4 individual buttons: Reset Game Clock, Reset Logs, Reset Crew, Reset Ship Status.
- Added a full-width RESET ALL GAME SETTINGS button below the grid that resets all 4 categories at once.

### Emergency Protocols — Unknown Biological Organism

- Added new emergency protocol: UNKNOWN BIOLOGICAL ORGANISM DETECTED.
- GM dialog provides free-text DECK and SECTION/LOCATION fields.
- Detection is always attributed to SENSOR ARRAY (no crew selector).
- Active status panel shows blinking alert with location on all terminals.
- Alert message format: "UNKNOWN BIOLOGICAL ORGANISM DETECTED — [DECK], [SECTION]".
- Added `bioalert` entry to EMERGENCY_PROTOCOLS config with sender SCIENCE and icon fa-biohazard.
- Wired into all hasActiveEmergency and anyRemaining checks.

### Emergency Protocols — Spoken Voice Warnings

- All emergency protocols (evacuate, lockdown, distress, purge, bioalert) now trigger repeating spoken computer voice warnings on player terminals, using the same Web Speech API voice and settings as self-destruct.
- Added `_startEmergencyVoice(protocol, message)` for generic repeating warnings (every 60 seconds).
- Added `_clearEmergencyVoice(protocol)` and `_clearAllEmergencyVoices()` for clean shutdown on cancel.
- Self-destruct abort now plays a spoken announcement: "ATTENTION. SELF-DESTRUCT SEQUENCE HAS BEEN ABORTED. RESUME NORMAL OPERATIONS." on both GM and player clients.
- Added `{ force }` option to `_speakWarning()` to allow one-shot announcements on the GM client.

### Bug Fixes

- Fixed CMD CODE navigation button using amber color instead of matching the default green of all other nav buttons.

---

## v1.0.6 — 2026-02-16

### Bug Fixes

- Fixed compendium folder IDs causing `DataModelValidationError` on load. Foundry v13 requires 16-character alphanumeric document IDs; replaced custom short IDs (e.g. `WYTcogMontero01`) with valid random IDs.
- Removed compendium auto-import on module load. The auto-import feature introduced in v1.0.4 was causing black screens and validation errors. Actors from `WYT-COG-ACTORS` compendium can be imported manually via the Compendium sidebar.
- Removed `compendiumImported` setting (no longer needed).

---

## v1.0.5 — 2026-02-16

### Bug Fixes

- Fixed black screen on GM login caused by compendium auto-import throwing an unhandled Promise rejection.
- Wrapped auto-import in error-safe `.catch()` so failures log to console instead of blocking the terminal.
- Added `pack.getIndex()` call before accessing pack folders to ensure the compendium index is loaded in FoundryVTT v13.
- Resolved OneDrive file locking error (`EPERM: operation not permitted, rmdir images`) by removing stale empty directory.

---

## v1.0.4 — 2026-02-16

### Compendium Packs

- Added WYT-COG-ACTORS compendium with all 24 Chariot of the Gods actors organized into folders: USCSS MONTERO (5), USCSS CRONUS (6), SOTILLO (4), and CREATURES (9).
- Removed legacy bulk compendium packs (actors, items, scenes, macros, journal, tables) that contained unfiltered world data.
- Module compendiums now auto-import into the world on first load (GM only). Actors are placed into matching world folders and duplicates are skipped.
- Import state is tracked per-world so the import only runs once.

### Compendium Build Pipeline

- Added `compendium-src/` directory with raw JSON source files for each actor, organized by ship subfolder.
- Added `compendium-src/build-packs.mjs` script that reads the JSON source files and writes LevelDB compendium packs.
- Run `npm run build-packs` to rebuild packs after editing JSON source files.
- Adding or removing actors from the compendium is now as simple as adding or deleting a JSON file and rebuilding.

### Documentation

- Rewrote README.md with hero image, demo video, focused feature overview, and cleaner install instructions.
- Added To Do section with planned features.
- Added Acknowledgments section crediting ecattell and muthurGPT.
- Updated License to clarify this is an unofficial fan production.
- Added DEMO.md with a narration script for demo video recording.

---

## v1.0.3 — 2026-02-15

### GM Terminal Window

- GM terminal is now a standard movable, resizable pop-out window instead of a full-screen takeover.
- GM can minimize and maximize the terminal, making it easy to access the underlying FoundryVTT interface during gameplay.
- GM can drag the terminal window around the screen and resize it as needed.

### Schematics (Scenes View)

- Fixed schematic controls for both GM and Player terminals.
- Added ship selection page with deck dropdown so players can browse schematics across enabled ships.
- GM toolbar now includes a PUSH TO PLAYERS button that forces the Player terminal to display a specific schematic.
- GM toolbar includes a SYNC TOKENS button to refresh token positions on both terminals.
- Added pinch-zoom and pan support for schematics on touch-screen displays.
- Token positions sync in real time between GM and Player terminals via socket.

### Token Management

- GM can now manage tokens on schematics directly from the terminal, including drag-to-move.
- Token create/update/delete hooks automatically broadcast position changes to Player terminals.
- Tokens must still be added to scenes via FoundryVTT's built-in scene editor.

### Crew Manifest — Live Actor Data

- Crew manifest now pulls live data from FoundryVTT Actor character sheets instead of static defaults.
- Displays health, stress, and radiation as visual bars with color coding (green/amber/red).
- Shows all four attributes (STR, AGL, WIT, EMP) in a centered block layout.
- Skills are grouped by parent attribute (Strength, Agility, Wits, Empathy) in a two-column grid.
- Active conditions from the Actor sheet (starving, dehydrated, exhausted, freezing, hypoxia, panic effects, critical injuries) display as individual red-bordered tags.
- Personnel file section shows appearance, personal agenda, buddy, rival, signature item, and notes pulled from the Actor sheet.
- Actor notes field (which may contain HTML) is automatically stripped to plain text for terminal display.
- GM can update crew member status and location from the crew detail view; changes broadcast to Player terminals.

### Crew — Ship Assignment

- GM can assign crew members to specific ships via a Ship Assignment dropdown in both the terminal crew detail view and the FoundryVTT Actor sheet.
- Ship assignment is stored as a FoundryVTT actor flag (flags.wy-terminal.shipAssignment).
- Crew list automatically filters by the active ship profile, showing only crew assigned to that ship plus any unassigned crew.
- If no explicit assignment is set, the system infers ship assignment from the actor's folder name (e.g., a folder named "Montero Crew" auto-assigns to the Montero).

### Internal

- Module version bumped to 1.0.3
- Added renderActorSheet and renderDocumentSheet hooks for ship assignment injection (v13 compatible, no jQuery dependency).
- Added _inferShipFromFolder() method for folder-name-based ship auto-detection.
- Added _renderVitalBar() helper for health/stress/radiation bar rendering.
- Added CSS for crew vitals, attribute blocks, skill groups, condition tags, and section dividers.


## v1.0.2 — 2026-02-14

### Emergency Protocols — Full Implementation

All five emergency protocols are now fully functional with unified framework, persistent state, socket sync, and player-facing alerts.

**Self-Destruct**
- Active countdown displayed on player STATUS screen
- GM dialog to select who armed the self-destruct
- STATUS nav button flashes red until player clicks it
- Alarm sound plays on activation
- Computer voice warning every real minute via Web Speech API
- Log event auto-created on arm and cancel

**Evacuation Protocol**
- Persistent warning on player STATUS screen
- STATUS nav button flashes red
- Alarm sound on activation
- GM dialog to select who triggered evacuation
- Log event auto-created

**Ship Lockdown**
- Amber-themed overlay on player STATUS screen indicating all doors locked
- GM dialog to set who triggered lockdown
- Log event auto-created

**Distress Signal**
- Broadcasting status shown on player STATUS screen
- GM dialog to set who triggered the signal
- Log event auto-created

**Atmosphere Purge**
- Deck-by-deck selection for Cronus (Deck A/B/C/D) or entire ship
- Montero defaults to entire ship (single deck)
- Persistent warning on player STATUS screen
- GM dialog to set who triggered the purge
- Log event auto-created

**Emergency Cancel**
- GM can cancel any active emergency from STATUS or EMERGENCY views
- Cancel correctly dismisses player alerts using authoritative server state (fixed race condition where socket ordering caused stale local state)
- Log event auto-created on cancel

### Command Codes — Relocated to CMD CODE View

- Moved command code management out of Settings/GM Controls into the CMD CODE view
- GM terminal shows MASTER_OVERRIDE banner (no keypad needed) plus code management UI (add, remove, save codes with auto-generated 8-digit codes)
- Player terminal keeps numeric keypad for code entry

### MU/TH/UR Terminal — Command Code Integration

- Players can now enter 8-digit command codes directly in the MU/TH/UR chat
- Invalid codes return ACCESS DENIED with buzz sound
- Valid codes below CORPORATE clearance return INSUFFICIENT CLEARANCE
- Valid CORPORATE or MASTER_OVERRIDE codes elevate clearance and respond with ACCESS GRANTED
- After code acceptance, the previous query is automatically resubmitted so the player gets their answer without retyping
- AI conversation history is reset on clearance elevation to prevent stale denial patterns

### MU/TH/UR Terminal — Clearance-Gated Classified Data

- Replaced hardcoded override code in Cronus AI prompt with clearance-level checks
- AI now reads ACTIVE CLEARANCE LEVEL from live telemetry data
- CORPORATE or MASTER_OVERRIDE clearance grants immediate access to classified Cronus mission intel without prompting for a code
- GM terminal always injects MASTER_OVERRIDE into AI context
- Lower clearance levels get "ACCESS RESTRICTED. WEYLAND CORPORATION EYES ONLY. ENTER COMMAND CODE."

### MU/TH/UR Terminal — Visual

- User-typed text and input field changed from cyan to green to match terminal theme
- Prompt character was already green (no change needed)

### Cargo Manifest

- Removed category filter buttons from both GM and player terminals — all cargo items now display by default
- Removed color-coded category badges (blue, red, yellow, etc.) — all TYPE badges now use uniform terminal green
- Removed related CSS (filter bar, filter buttons, per-category color classes) and JS (filter click handlers, category data generation)

### Systems View

- Fixed ADD SYSTEM button width to match SAVE CONFIGURATION button

### Bug Fixes

- Fixed emergency cancel race condition where player alert wouldn't dismiss because the emergencyCancelled socket arrived before statusUpdate, leaving local state stale. GM now includes authoritative anyRemaining flag in the cancel payload.
- Fixed MU/TH/UR engine not recognizing GM as MASTER_OVERRIDE clearance when building live ship context (was reading raw world setting which only stored player clearance)
- Added resetConversation() to MuthurEngine to clear cached conversation turns and summaries when clearance level changes

### Internal

- Module version bumped to 1.0.2
- Added static EMERGENCY_PROTOCOLS config object mapping protocol keys to labels, socket types, log messages, and alert text
- Added unified emergency helper methods: _activateEmergency(), _cancelEmergency(), _showEmergencyTriggerDialog(), _showAtmospherePurgeDialog()
- Added _flashStatusButton() for red nav button pulse animation
- Added _tryCommandCodeInMuthur() for code validation in chat
- Added _lastMuthurQuery tracking for auto-resubmit after code entry
- Added CSS keyframes: wy-eo-pulse, wy-eo-pulse-amber, navRedFlash
- Added emergency overlay CSS classes: wy-emergency-overlay, wy-emergency-self-destruct, wy-emergency-lockdown, wy-emergency-active-box
