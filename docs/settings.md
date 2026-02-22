# Settings Reference

> **File:** `scripts/settings.mjs` (~341 lines)

All module settings are registered in `registerSettings()` called during `Hooks.once('init')`. Settings use FoundryVTT's `game.settings` API.

---

## Table of Contents

- [Setting Scopes](#setting-scopes)
- [Ship Identity](#ship-identity)
- [MU/TH/UR AI Configuration](#muthur-ai-configuration)
- [Terminal Display](#terminal-display)
- [Ship Data (Internal)](#ship-data-internal)
- [Navigation (Internal)](#navigation-internal)
- [Game Clock (Internal)](#game-clock-internal)
- [Clearance & Authentication (Internal)](#clearance--authentication-internal)
- [UI Configuration (Internal)](#ui-configuration-internal)
- [Reading & Writing Settings](#reading--writing-settings)
- [Adding a New Setting](#adding-a-new-setting)

---

## Setting Scopes

| Scope | Visibility | Stored In | Who Can Change |
|-------|-----------|-----------|----------------|
| `world` | Same for all users | World database | GM only |
| `client` | Per-browser | Browser local storage | Each user |

| Config | Meaning |
|--------|---------|
| `config: true` | Appears in FoundryVTT Module Settings dialog |
| `config: false` | Hidden — managed programmatically by the terminal |

---

## Ship Identity

These appear in the FoundryVTT Module Settings dialog and control what's displayed in the terminal header.

| Setting Key | Type | Default | Scope | Description |
|------------|------|---------|-------|-------------|
| `activeShip` | `String` | `'montero'` | world | Active ship profile ID. Determines systems, crew, cargo, and UI theme. Not in settings dialog — managed from in-terminal CONFIG. |
| `shipName` | `String` | `'USCSS MONTERO'` | world | Vessel name displayed in terminal header |
| `shipClass` | `String` | `'M-CLASS STARFREIGHTER'` | world | Ship class designation |
| `shipRegistry` | `String` | `'REG# 220-8170421'` | world | Registration number |
| `missionName` | `String` | `'CHARIOTS OF THE GODS'` | world | Current mission designation |
| `muthurUrl` | `String` | `''` | world | External MU/TH/UR web interface URL. Blank = use built-in engine. |
| `statusPath` | `String` | `'modules/wy-terminal/status'` | world | Path to ship status JSON files in Foundry data directory |

### Example — Change Ship Identity

```javascript
// Via Foundry settings API:
await game.settings.set('wy-terminal', 'shipName', 'USCSS EUROPA');
await game.settings.set('wy-terminal', 'shipClass', 'S-CLASS SURVEY VESSEL');
await game.settings.set('wy-terminal', 'shipRegistry', 'REG# 330-9981234');
```

---

## MU/TH/UR AI Configuration

| Setting Key | Type | Default | Scope | Description |
|------------|------|---------|-------|-------------|
| `openaiBaseUrl` | `String` | `'https://api.openai.com/v1'` | world | OpenAI-compatible API base URL. For local Ollama: `http://localhost:11434/v1` |
| `openaiApiKey` | `String` | `''` | world | API key for AI responses. Required for OpenAI, blank for Ollama. |
| `openaiModel` | `String` | `'gpt-4o-mini'` | world | Model name (e.g. `gpt-4o-mini`, `gpt-4.1-nano`, `llama3.1:8b`) |
| `muthurPlugin` | `String` | `'cronus'` | world | Active scenario plugin. Choices: `montero`, `cronus`, `cronus_life_support`, `fort_nebraska` |
| `muthurConversation` | `Array` | `[]` | world | Persisted conversation history (internal) |

---

## Terminal Display

| Setting Key | Type | Default | Scope | Description |
|------------|------|---------|-------|-------------|
| `scanlines` | `String` | `'medium'` | world | CRT scanline overlay intensity: `off`, `light`, `medium`, `heavy` |
| `crtFlicker` | `String` | `'medium'` | world | CRT flicker animation intensity: `off`, `light`, `medium`, `heavy` |
| `soundEnabled` | `Boolean` | `true` | client | Enable terminal beep and keyboard sounds |
| `terminalWidth` | `Number` | `1200` | client | Terminal window width in pixels (Normal mode only) |
| `terminalHeight` | `Number` | `800` | client | Terminal window height in pixels (Normal mode only) |

---

## Ship Data (Internal)

These settings store ship state and are managed by `ShipStatusManager` and the terminal UI. They are all `scope: 'world'`, `config: false`.

| Setting Key | Type | Default | Description |
|------------|------|---------|-------------|
| `shipStatusData` | `Object` | `{}` | Persisted ship status data blob |
| `shipSystems` | `Array` | `[]` | Ship systems diagnostics. Each entry: `{ name, status, detail, powerPct, classification? }` |
| `crewRoster` | `Array` | `[]` | Crew roster. Each entry: `{ name, role, location, status, statusClass, statusTextClass }` |
| `logEntries` | `Array` | `[]` | Ship log entries. Each: `{ timestamp, sender, subject, detail, classification? }` |
| `cargoManifest` | `Array` | `[]` | Cargo items. Each: `{ name, qty, category, location, description }` |
| `maps` | `Array` | `[]` | Ship map image configurations |
| `commFrequency` | `String` | `'475.12'` | Active communications frequency (###.## format, no MHz suffix) |
| `starSystemsData` | `Object` | `{ added: [], modified: {}, deleted: [] }` | GM overrides for the stellar cartography database |

### System Entry Schema

```javascript
{
  name: 'REACTOR',           // Display name
  status: 'ONLINE',          // Status text: ONLINE, OFFLINE, DAMAGED, CRITICAL, etc.
  detail: 'PWR OUTPUT NOMINAL', // Detail text shown in diagnostics
  powerPct: 100,             // Power percentage (0-100)
  classification: 'CORPORATE' // Optional clearance gate: MEDICAL, CAPTAIN, CORPORATE, SENSITIVE, RESTRICTED
}
```

### Log Entry Schema

```javascript
{
  timestamp: '2183-03-15 07:30',
  sender: 'COMMS RELAY',
  subject: 'INCOMING SIGNAL DETECTED',
  detail: 'Signal analysis indicates emergency distress beacon...',
  classification: 'CAPTAIN'   // Optional: MEDICAL, CAPTAIN, CORPORATE, SENSITIVE, RESTRICTED
}
```

---

## Navigation (Internal)

| Setting Key | Type | Default | Description |
|------------|------|---------|-------------|
| `navData` | `Object` | `{ navMarkers: [...] }` | Navigation state including heading, speed, fuel, ETA, position, destination, and map markers |

### navData Shape

```javascript
{
  heading: '231.119',
  speed: '0.15c',
  fuel: '78%',
  eta: '12H 45M',
  position: '24.3, 39.2',
  destination: 'USCSS CRONUS',
  shipPos: { x: 0.35, y: 0.42 },
  routePoints: [...],
  navMarkers: [
    { id: 'DEFAULT_DEPARTURE', label: 'ANCHORPOINT STATION', type: 'DEPARTURE', x: 0.569, y: 0.377 },
    { id: 'DEFAULT_DESTINATION', label: 'UNKNOWN SIGNAL', type: 'DESTINATION', x: 0.251, y: 0.389 },
    { id: 'DEFAULT_PLAYER', label: 'USCSS MONTERO', type: 'PLAYER', x: 0.569, y: 0.377, progress: 0 },
    // ...
  ],
}
```

Marker types: `DEPARTURE`, `WAYPOINT`, `DESTINATION`, `PLANET`, `PLAYER`, `STATION`, `HAZARD`.

---

## Game Clock (Internal)

| Setting Key | Type | Default | Description |
|------------|------|---------|-------------|
| `gameClockEpoch` | `Number` | `Date.UTC(2183, 5, 12, 6, 0, 0)` | Game-world timestamp in ms since JS epoch (2183-06-12 06:00 UTC) |
| `gameClockRealAnchor` | `Number` | `0` | Real-world `Date.now()` when epoch was last set |
| `gameClockPaused` | `Boolean` | `true` | Whether the game clock is paused. Starts stopped — GM must hit START CLOCK. |

The game clock runs at **10× real time** — 1 real minute = 10 in-game minutes.

---

## Clearance & Authentication (Internal)

| Setting Key | Type | Default | Description |
|------------|------|---------|-------------|
| `activeClearanceLevel` | `String` | `'CREWMEMBER'` | Legacy single-value clearance (kept for migration) |
| `userClearanceLevels` | `Object` | `{}` | Per-user clearance: `{ [userId]: 'CORPORATE', ... }` |
| `commandCodes` | `Array` | `[]` | Legacy command codes array (kept for migration) |
| `userCommandCodes` | `Object` | `{}` | Per-user command codes: `{ [userId]: { code: '0012345678', role: 'CAPTAIN' }, ... }` |

### Command Code Entry Schema

```javascript
// userCommandCodes value:
{
  "userId123": {
    code: "0025565535",     // 10-digit numeric string
    role: "CAPTAIN"         // Clearance role granted: CREWMEMBER, MEDICAL, CAPTAIN, CORPORATE, MASTER_OVERRIDE
  }
}
```

---

## UI Configuration (Internal)

| Setting Key | Type | Default | Description |
|------------|------|---------|-------------|
| `crewFolders` | `Array` | `[]` | Actor Folder IDs to show in CREW view. Empty = show all character/synthetic actors. |
| `enabledShips` | `Array` | `[]` | Ship profile IDs enabled for player schematic selector. Empty = all visible. |
| `eventTimers` | `Array` | `[]` | Event timers tracked against game clock. Each: `{ id, label, category, gameTargetTime, createdAt, actions, status }` |

### Event Timer Schema

```javascript
{
  id: 'timer-abc123',
  label: 'REACTOR OVERLOAD',
  category: 'emergency',         // Category for grouping/display
  gameTargetTime: 6789012345678, // Game-world ms timestamp when timer fires
  createdAt: 1234567890123,      // Real-world creation timestamp
  actions: [                     // What happens when timer fires
    { type: 'broadcast', message: 'CRITICAL: REACTOR OVERLOAD' },
    { type: 'play_sound', sound: 'horn' }
  ],
  status: 'active'               // 'active', 'completed', or 'cancelled'
}
```

---

## Reading & Writing Settings

```javascript
// Read a setting
const shipName = game.settings.get('wy-terminal', 'shipName');
const systems = game.settings.get('wy-terminal', 'shipSystems');

// Write a setting (GM only for world-scoped settings)
await game.settings.set('wy-terminal', 'shipName', 'USCSS EUROPA');
await game.settings.set('wy-terminal', 'shipSystems', [
  { name: 'REACTOR', status: 'ONLINE', detail: 'NOMINAL', powerPct: 100 },
  // ...
]);

// Changes to world settings automatically propagate to all connected clients
```

---

## Adding a New Setting

1. **Register** in `scripts/settings.mjs` inside `registerSettings()`:

```javascript
game.settings.register('wy-terminal', 'myNewSetting', {
  name: 'My Setting Name',           // Display name in settings UI
  hint: 'Description of what it does', // Tooltip text
  scope: 'world',                     // 'world' or 'client'
  config: true,                       // true = show in Module Settings dialog
  type: String,                       // String, Number, Boolean, Object, Array
  default: 'default value',          // Default value
  // For dropdowns:
  // choices: { key1: 'Label 1', key2: 'Label 2' },
});
```

2. **Read** the setting where needed:

```javascript
const value = game.settings.get('wy-terminal', 'myNewSetting');
```

3. **Write** the setting (for internal settings managed by the UI):

```javascript
await game.settings.set('wy-terminal', 'myNewSetting', newValue);
```

4. If the setting should trigger a UI refresh when changed, emit a socket event in the code that writes it:

```javascript
game.socket.emit('module.wy-terminal', { type: 'refreshView', payload: { view: 'status' } });
```
