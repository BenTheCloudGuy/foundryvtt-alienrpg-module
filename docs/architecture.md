# WY-Terminal Architecture

> Module ID: `wy-terminal` — Weyland-Yutani Ship Terminal for FoundryVTT / AlienRPG

This document describes the full architecture of the WY-Terminal module: how the files are organized, how data flows between components, and how the runtime lifecycle works.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [File Map](#file-map)
- [Runtime Lifecycle](#runtime-lifecycle)
- [Component Diagram](#component-diagram)
- [Data Flow](#data-flow)
- [View System](#view-system)
- [Socket Communication](#socket-communication)
- [Settings Architecture](#settings-architecture)
- [Clearance & Authentication](#clearance--authentication)
- [Related Documentation](#related-documentation)

---

## High-Level Overview

The module runs entirely inside FoundryVTT's browser environment. There is no separate server process. The entry point is `scripts/wy-terminal.mjs`, which registers settings, loads templates, and opens the terminal Application window.

```
┌──────────────────────────────────────────────────────┐
│                   FoundryVTT Server                  │
│                   (serves static files)              │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP + WebSocket
        ┌──────────────┴──────────────┐
        │      GM Browser Client      │       │    Player Browser Client    │
        │  ┌──────────────────────┐   │       │  ┌──────────────────────┐  │
        │  │   WYTerminalApp      │   │       │  │   WYTerminalApp      │  │
        │  │  (pop-out window)    │   │       │  │  (full-screen)       │  │
        │  └──────────┬───────────┘   │       │  └──────────┬───────────┘  │
        │             │               │       │             │              │
        │  ┌──────────┴───────────┐   │       │  ┌──────────┴───────────┐  │
        │  │  MuthurBridge        │   │       │  │  MuthurBridge        │  │
        │  │  └─ MuthurEngine     │   │       │  │  └─ MuthurEngine     │  │
        │  │  ShipStatusManager   │   │       │  │  ShipStatusManager   │  │
        │  └──────────────────────┘   │       │  └──────────────────────┘  │
        └─────────────────────────────┘       └────────────────────────────┘
                       │                                   │
                       └───── module.wy-terminal socket ───┘
```

**Key architectural decisions:**

- **Player clients run full-screen** — all Foundry UI chrome is hidden. The terminal IS the interface.
- **GM clients run in a pop-out window** — the GM still has access to all Foundry features underneath.
- **Real-time sync** — crew, systems, logs, alerts, clearance, timers, and navigation all sync between GM and players via Foundry sockets.
- **AI runs client-side** — MuthurEngine calls OpenAI (or Ollama) directly from the browser using `fetch()`. No server-side proxy.

---

## File Map

```
wy-terminal/
├── module.json                    # FoundryVTT module manifest
├── package.json                   # Node dependencies (classic-level for compendium builds)
│
├── scripts/
│   ├── wy-terminal.mjs            # Entry point — Hooks.init + Hooks.ready, auto-open
│   ├── terminal-app.mjs           # Main Application class (~6750 lines, 141 methods)
│   ├── muthur-engine.mjs          # AI engine — prompt assembly, OpenAI calls, conversation mgmt
│   ├── muthur-bridge.mjs          # Communication layer — engine / iframe / GM-relay modes
│   ├── settings.mjs               # All game.settings.register() calls
│   ├── ship-profiles.mjs          # Ship profile definitions (Montero, Cronus)
│   ├── ship-status.mjs            # ShipStatusManager — crew, systems, logs, maps, cargo CRUD
│   ├── terminal-sounds.mjs        # TerminalSFX — player-only sound effects
│   └── pinch-zoom.mjs             # PinchZoomHandler — touch/mouse zoom and pan
│
├── styles/
│   └── terminal.css               # All terminal CSS (~3600 lines)
│
├── templates/
│   ├── terminal.hbs               # Main Application shell (header, nav, display frame, footer)
│   └── views/
│       ├── boot.hbs               # Boot sequence animation
│       ├── status.hbs             # Ship status overview
│       ├── crew.hbs               # Personnel roster (from Actor sheets)
│       ├── systems.hbs            # Ship systems diagnostics
│       ├── logs.hbs               # Ship log entries (clearance-gated)
│       ├── muthur.hbs             # MU/TH/UR AI chat interface
│       ├── scenes.hbs             # FoundryVTT scene renderer (schematics)
│       ├── starsystems.hbs        # Stellar cartography database
│       ├── nav.hbs                # Navigation / route planner
│       ├── comms.hbs              # Communications array
│       ├── cargo.hbs              # Cargo manifest
│       ├── commandcode.hbs        # Command code keypad + RFID scan
│       ├── emergency.hbs          # Emergency protocols (GM only)
│       ├── gameclock.hbs          # Game clock (GM only)
│       ├── timers.hbs             # Event timers (GM only)
│       ├── weapons.hbs            # Weapons systems (Cronus only)
│       ├── science.hbs            # Science systems (Cronus only)
│       ├── settings.hbs           # GM settings panel
│       └── maps.hbs               # Static map viewer
│
├── muthur/
│   ├── config.json                # Base AI config (model, speed, header)
│   ├── starsystems.json           # Stellar cartography database (~975 lines)
│   ├── logs-montero.json          # Pre-written log entries for Montero scenario
│   ├── logs-cronus.json           # Pre-written log entries for Cronus scenario
│   ├── ascii/                     # ASCII art (deck maps, logos)
│   ├── sounds/                    # WAV files (beep, boot, buzz, horn, etc.)
│   ├── prompts/
│   │   ├── prompt_prefix.txt      # Shared system prompt header
│   │   └── prompt_suffix.txt      # Shared system prompt footer
│   └── plugins/
│       ├── montero/               # Montero scenario plugin
│       │   ├── config.json        # Scenario state, crew, systems, logs, command codes
│       │   └── prompts/
│       │       └── montero_prompt.txt
│       ├── cronus/                # Cronus scenario plugin
│       │   ├── config.json
│       │   └── prompts/
│       │       └── cronus_prompt.txt
│       ├── cronus_life_support/   # Cronus variant (life support failure)
│       │   ├── config.json
│       │   └── prompts/
│       │       └── cronus_life_support_prompt.txt
│       └── fort_nebraska/         # Fort Nebraska scenario plugin
│           ├── config.json
│           └── prompts/
│               └── fort_nebraska_prompt.txt
│
├── lang/
│   └── en.json                    # i18n strings
│
├── packs/
│   └── wyt-cog-actors/            # LevelDB compendium pack (pre-built Actor data)
│
├── compendium-src/
│   ├── build-packs.mjs            # Build LevelDB pack from JSON source
│   └── wyt-cog-actors/            # JSON actor files organized by folder
│       ├── montero/               # Montero crew actors
│       ├── cronus/                # Cronus crew actors
│       ├── sotillo/               # Sotillo crew actors
│       └── creatures/             # Creature actors
│
├── images/                        # Screenshots, logos
├── media/audio/                   # Audio files for log entries
├── status/                        # Ship status JSON export directory
└── local-ai/                      # Docker setup for local Ollama + Whisper
```

---

## Runtime Lifecycle

### 1. `Hooks.once('init')` — Module Registration

**File:** `scripts/wy-terminal.mjs`

```javascript
Hooks.once('init', () => {
  registerSettings();           // All game.settings.register() calls
  _registerHandlebarsHelpers(); // eq, ne, gt, gte, or, and, not, includes, json, uppercase, lowercase, truncate
  loadTemplates([...]);         // Pre-load all .hbs templates
});
```

### 2. `Hooks.once('ready')` — Terminal Launch

```javascript
Hooks.once('ready', () => {
  shipStatus = new ShipStatusManager();   // Load persisted ship data

  // Player → full-screen terminal (hide all Foundry chrome)
  // GM     → normal Foundry + pop-out terminal window
  if (!game.user.isGM) _enableTerminalDisplayMode();

  openTerminal();  // Creates and renders WYTerminalApp
});
```

### 3. `WYTerminalApp.getData()` → Handlebars Render

The Application's `getData()` method assembles the shell data (ship name, class, registry, date, clearance level, CRT settings) and returns it for `templates/terminal.hbs`.

### 4. `activateListeners()` → Nav Buttons → View Switching

Navigation button clicks call `_switchView(viewName)` which:
1. Gets view-specific data from `_getViewData(viewName)` (a giant switch statement)
2. Renders the view template into the content area
3. Calls `_onViewRendered(viewName, contentEl)` to wire up event listeners

### 5. Socket Events — Cross-Client Sync

All clients listen on `module.wy-terminal` for:
- `statusUpdate` — ship status changes
- `setClearance` — clearance elevation requests
- `clearanceUpdated` — broadcast clearance changes
- `muthurQuery` / `muthurResponse` — GM relay mode
- `refreshView` — force re-render on all clients
- `gmCommand` — GM commands (broadcast, inject, flag toggle, plugin switch)
- `alert` — emergency alerts with sound

---

## Component Diagram

```
WYTerminalApp (terminal-app.mjs)
  │
  ├── ShipStatusManager (ship-status.mjs)
  │     └── Reads/writes FoundryVTT world settings
  │         (crewRoster, shipSystems, logEntries, cargoManifest, maps, etc.)
  │
  ├── MuthurBridge (muthur-bridge.mjs)
  │     ├── MuthurEngine (muthur-engine.mjs)  ← ENGINE mode (AI calls)
  │     ├── iframe embed                       ← IFRAME mode (external UI)
  │     └── GM relay via socket                ← RELAY mode (no API)
  │
  ├── PinchZoomHandler (pinch-zoom.mjs)
  │     └── Attached to MAPS, SCHEMATICS, NAV views
  │
  ├── TerminalSFX (terminal-sounds.mjs)
  │     └── Player-only audio (beep, boot, buzz, alert, etc.)
  │
  └── Ship Profiles (ship-profiles.mjs)
        └── MONTERO, CRONUS definitions (systems, crew, cargo defaults)
```

---

## Data Flow

### Ship Data (GM → Players)

```
GM changes crew/system/log/cargo via terminal UI
  → game.settings.set('wy-terminal', 'crewRoster', [...])
  → socket.emit('module.wy-terminal', { type: 'statusUpdate', payload })
  → All player clients receive update → re-render current view
```

### MU/TH/UR AI Chat

```
Player types message in MU/TH/UR view
  → MuthurBridge.sendMessage(text)
  → MuthurEngine.getReply(text)
      ├── Builds system prompt (prefix + plugin prompt + dynamic context + suffix)
      ├── Filters telemetry by user clearance level
      ├── Sends to OpenAI API via fetch()
      └── Returns response text
  → Response displayed in chat with typewriter effect
```

### Clearance Elevation

```
Player enters command code (keypad or RFID scan)
  → Code validated against ALL registered user codes
  → If match: socket.emit('setClearance', { level: 'CORPORATE', userId })
  → GM client receives → game.settings.set('wy-terminal', 'userClearanceLevels', {...})
  → Clearance propagated to all clients
  → Logs, telemetry, and AI responses now reflect new clearance
```

---

## View System

Each view follows a three-part pattern:

| Step | Method | Purpose |
|------|--------|---------|
| 1 | `_getViewData(viewName)` | Assemble data object for Handlebars |
| 2 | Template render | `templates/views/{viewName}.hbs` |
| 3 | `_setup{ViewName}View(contentEl)` | Wire up DOM event listeners |

**View list with data sources:**

| View | Template | Data Source | Setup Method |
|------|----------|-------------|--------------|
| boot | boot.hbs | Ship profile | *(animation only)* |
| status | status.hbs | `shipSystems`, `crewRoster` | `_setupStatusView` |
| crew | crew.hbs | FoundryVTT Actor sheets | `_setupCrewView` |
| systems | systems.hbs | `shipSystems` setting | `_setupSystemsView` |
| logs | logs.hbs | `logEntries` + file logs | `_setupLogsView` |
| muthur | muthur.hbs | Chat history | `_setupMuthurView` |
| scenes | scenes.hbs | FoundryVTT Scenes | `_setupScenesView` |
| starsystems | starsystems.hbs | `starsystems.json` + overrides | `_setupStarSystemsView` |
| nav | nav.hbs | `navData` setting | `_setupNavView` |
| comms | comms.hbs | `commFrequency` setting | `_setupCommsView` |
| cargo | cargo.hbs | `cargoManifest` setting | `_setupCargoView` |
| commandcode | commandcode.hbs | `userCommandCodes` setting | `_setupCommandCodeView` |
| emergency | emergency.hbs | Emergency state flags | `_setupEmergencyView` |
| gameclock | gameclock.hbs | `gameClockEpoch` setting | `_setupGameClockView` |
| timers | timers.hbs | `eventTimers` setting | `_setupTimersView` |
| weapons | weapons.hbs | Ship profile weapons | *(Cronus only)* |
| science | science.hbs | Ship profile science | *(Cronus only)* |
| settings | settings.hbs | All settings | `_setupSettingsView` |
| maps | maps.hbs | `maps` setting | *(PinchZoom)* |

---

## Socket Communication

All socket messages use the `module.wy-terminal` channel.

| Message Type | Direction | Payload | Purpose |
|-------------|-----------|---------|---------|
| `statusUpdate` | GM → All | `{ ...updates }` | Ship status changes |
| `setClearance` | Player → GM | `{ level, userId }` | Request clearance elevation |
| `clearanceUpdated` | GM → All | `{ level, userId }` | Broadcast new clearance |
| `refreshView` | Any → All | `{ view }` | Force re-render |
| `muthurQuery` | Player → GM | `{ from, message }` | GM relay query |
| `muthurResponse` | GM → Player | `{ reply }` | GM relay response |
| `gmCommand` | GM → All | `{ type, ... }` | Broadcast, inject, flag, plugin |
| `alert` | GM → All | `{ message, sound }` | Emergency alert |

---

## Settings Architecture

All settings are registered in `scripts/settings.mjs`. See [settings.md](settings.md) for the complete reference.

**Categories:**

- **User-visible** (`config: true`): Ship name, class, registry, mission, API settings, sound, dimensions
- **Internal** (`config: false`): All game state — crew, systems, logs, cargo, maps, nav, clearance, timers, clock
- **Client-scoped** (`scope: 'client'`): Sound, terminal dimensions
- **World-scoped** (`scope: 'world'`): Everything else (shared across all clients)

---

## Clearance & Authentication

The module implements a multi-tier clearance system:

| Level | Rank | Access |
|-------|------|--------|
| `NONE` / `CREWMEMBER` | 0 | Basic ship data, public logs |
| `MEDICAL` | 1 | Medical records, quarantine data |
| `CAPTAIN` | 2 | Full crew data, captain's logs |
| `CORPORATE` | 3 | All classified data, Special Orders |
| `MASTER_OVERRIDE` | 4 | Everything (GM default) |

**Per-user clearance:** Each FoundryVTT user has an independent clearance level stored in `userClearanceLevels`.

**Command codes:** Each user has a unique 10-digit code stored in `userCommandCodes`. Entering ANY valid code on ANY terminal grants the associated clearance role.

**RFID support:** The CMD CODE view includes a hidden input that captures rapid keyboard input from HID card readers. If 10 digits arrive within 500ms, it's treated as an RFID card scan and auto-submits.

**Clearance affects:**
- Log entry visibility (classification gating)
- MU/TH/UR AI responses (telemetry filtering + prompt instructions)
- Crew detail access (MEDICAL/CAPTAIN see all except COMPANY AGENT; CORPORATE sees ALL)

---

## Related Documentation

- [settings.md](settings.md) — Complete settings reference
- [terminal-app.md](terminal-app.md) — WYTerminalApp class reference
- [muthur-engine.md](muthur-engine.md) — MU/TH/UR AI engine internals
- [plugins.md](plugins.md) — Plugin system and scenario authoring
- [customization.md](customization.md) — How to customize, override, and extend
- [muthur-notes.md](muthur-notes.md) — Development notes on MU/TH/UR
- [dev/muthur-tests.md](dev/muthur-tests.md) — MU/TH/UR test queries
