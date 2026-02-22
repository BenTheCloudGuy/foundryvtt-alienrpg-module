# WYTerminalApp — Class Reference

> **File:** `scripts/terminal-app.mjs` (~6,750 lines, 141 methods)

The main Application class that renders the terminal UI, manages all views, and coordinates between the MU/TH/UR engine, ship status, and FoundryVTT.

---

## Table of Contents

- [Class Overview](#class-overview)
- [Inheritance](#inheritance)
- [Instance Properties](#instance-properties)
- [Lifecycle Methods](#lifecycle-methods)
- [View System](#view-system)
- [View Data Providers](#view-data-providers)
- [View Setup Methods](#view-setup-methods)
- [Clearance & Authentication](#clearance--authentication)
- [Emergency Protocols](#emergency-protocols)
- [Event Timers](#event-timers)
- [Utility Methods](#utility-methods)
- [Adding a New View](#adding-a-new-view)

---

## Class Overview

```javascript
import { WYTerminalApp } from './terminal-app.mjs';

// The app is a singleton managed by wy-terminal.mjs
// Access the running instance:
const app = game.wyTerminal.app();
```

`WYTerminalApp` extends FoundryVTT's `Application` class. It renders a single Handlebars template (`templates/terminal.hbs`) as the shell, then dynamically swaps view content inside `#wy-content-frame`.

---

## Inheritance

```
foundry.applications.api.Application
  └── WYTerminalApp
```

### Static Defaults

```javascript
static get defaultOptions() {
  return mergeObject(super.defaultOptions, {
    id: 'wy-terminal',
    title: 'W-Y TERMINAL',
    template: 'modules/wy-terminal/templates/terminal.hbs',
    width: 1200,    // overridden by user setting
    height: 800,    // overridden by user setting
    resizable: true,
    classes: ['wy-terminal-app'],
  });
}
```

---

## Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `shipStatus` | `ShipStatusManager` | Manages crew, systems, logs, cargo |
| `activeView` | `string` | Current view name (default: `'boot'`) |
| `zoomHandler` | `PinchZoomHandler\|null` | Active zoom handler for maps/scenes |
| `muthurBridge` | `MuthurBridge\|null` | AI communication layer |
| `chatHistory` | `Array` | MU/TH/UR conversation display buffer |
| `alertMessage` | `string\|null` | Active broadcast alert text |
| `activeSceneId` | `string\|null` | Currently displayed scene ID |
| `activeMapId` | `string\|null` | Currently displayed static map ID |
| `_fileLogCache` | `Array\|null` | Cached file-based log entries |

---

## Lifecycle Methods

### `constructor(options)`
Line 44. Initializes properties, reads ship status from settings.

### `getData()` → `Object`
Line 103. Returns shell data for `terminal.hbs`:

```javascript
{
  shipName, shipClass, shipRegistry, missionName,
  displayTitle,         // formatted ship name + class
  gameDate,             // in-game date string
  isGM,                 // true for GM clients
  playerClearance,      // current user's clearance level
  scanlines,            // 'off' | 'light' | 'medium' | 'heavy'
  crtFlicker,           // 'off' | 'light' | 'medium' | 'heavy'
  navButtons,           // array of { view, icon, label } for navigation
  muthurHeader,         // e.g. 'MU/TH/UR 6500'
  activeShip,           // current ship profile id
}
```

### `activateListeners(html)`
Line 157. Wires up:
- Navigation button clicks → `_switchView()`
- Socket listeners for cross-client sync
- Boot sequence → auto-switch to STATUS after animation
- Keyboard shortcuts

### `close(options)`
Line 207. Cleans up zoom handler, MU/TH/UR bridge, timers, intervals.

---

## View System

### `_switchView(viewName)`
Line 233. The main view router:

1. Validates view exists
2. Checks clearance for restricted views
3. Destroys existing zoom handler
4. Plays screen change sound
5. Calls `_renderView(viewName)`
6. Updates nav button active state
7. Updates `this.activeView`

### `_renderView(viewName)` → `Promise`
Line 306. Renders a view template into the content frame:

```javascript
async _renderView(viewName) {
  const data = this._getViewData(viewName);
  const html = await renderTemplate(
    `modules/wy-terminal/templates/views/${viewName}.hbs`,
    data
  );
  const frame = this.element.find('#wy-content-frame');
  frame.html(html);
  const contentEl = frame[0];
  this._onViewRendered(viewName, contentEl);
}
```

### `_onViewRendered(viewName, contentEl)`
Line 1492. Dispatches to the per-view setup method:

```javascript
_onViewRendered(viewName, contentEl) {
  switch (viewName) {
    case 'crew':        this._setupCrewView(contentEl); break;
    case 'systems':     this._setupSystemsView(contentEl); break;
    case 'logs':        this._setupLogsView(contentEl); break;
    case 'muthur':      this._setupMuthurView(contentEl); break;
    case 'scenes':      this._setupScenesView(contentEl); break;
    case 'commandcode': this._setupCommandCodeView(contentEl); break;
    // ... etc for all views
  }
}
```

### `refreshCurrentView()`
Line 335. Re-renders the active view without switching. Called after settings changes, socket updates, etc.

---

## View Data Providers

Each view has a data provider method called from `_getViewData()`:

### Core Views

| Method | Line | Returns |
|--------|------|---------|
| `_getSystemsData()` | 578 | Systems array with status classes |
| `_getSystemsDetailData()` | 587 | Detailed system info with power percentages |
| `_getCrewData()` | 609 | Crew from Actor sheets: name, career, job, age, ship, health, stress, conditions, portrait, notes |
| `_getLogData()` | 795 | Merged file + setting logs, sorted by timestamp, filtered by clearance |
| `_getScenesData()` | 853 | FoundryVTT scenes with thumbnails, token data |
| `_getStarSystemsData()` | 1100 | Star systems from JSON + GM overrides |
| `_getNavData()` | 1269 | Navigation markers, route, heading, speed, fuel, ETA |
| `_getCommsData()` | 1348 | Comm frequency, encryption status |
| `_getCargoViewData()` | 1388 | Cargo manifest with categories, locations |
| `_getWeaponsData()` | 1421 | Weapons systems from ship profile |
| `_getScienceData()` | 1465 | Science systems from ship profile |
| `_getEmergencyData()` | 1150 | Emergency protocol states |
| `_getGameClockDisplayData()` | 6404 | Game clock time, paused state |
| `_getTimersViewData()` | 5772 | Active and completed event timers |

### Crew Data — Actor Sheet Integration

The CREW view pulls data directly from FoundryVTT Actor sheets:

```javascript
_getCrewData() {
  // Filter actors by selected crew folders
  const folders = game.settings.get('wy-terminal', 'crewFolders') || [];
  let actors = game.actors.filter(a =>
    a.type === 'character' || a.type === 'synthetic'
  );

  if (folders.length) {
    actors = actors.filter(a => folders.includes(a.folder?.id));
  }

  return actors.map(actor => ({
    name:    actor.name,
    career:  actor.system?.career || '',     // from AlienRPG career field
    job:     actor.system?.occupation || '',  // from AlienRPG occupation field
    age:     actor.system?.age || '',
    ship:    this._inferShipFromFolder(actor),
    health:  { value: actor.system?.header?.health?.value, max: actor.system?.header?.health?.max },
    stress:  { value: actor.system?.header?.stress?.value, max: actor.system?.header?.stress?.max },
    // ... attributes, skills, conditions, notes, portrait
  }));
}
```

---

## View Setup Methods

These methods wire up DOM event listeners after a view template renders. They are the primary place to add interactivity.

### Key Setup Methods

#### `_setupCrewView(contentEl)` — Line 3541
- Crew card click → detail panel
- Location dropdown (GM only)
- Clearance gating: VIEW button requires MEDICAL/CAPTAIN (all except COMPANY AGENT) or CORPORATE (all)

#### `_setupSystemsView(contentEl)` — Line 1808
- System status toggles (GM only)
- Power slider (GM only)
- Detail expansion

#### `_setupLogsView(contentEl)` — Line 1550
- Log entry expansion
- Media playback (audio waveform player)
- GM add/delete log entries
- Clearance-filtered display

#### `_setupMuthurView(contentEl)` — Line 1961
- Chat input + send
- Typewriter response animation
- History scrollback
- Bridge initialization

#### `_setupCommandCodeView(contentEl)` — Line 4029
- On-screen keypad (digit buttons, CLR, ENT)
- Hidden input for keyboard/RFID capture
- RFID scan detection (10 digits < 500ms = card scan)
- Code validation against all registered codes
- Clearance elevation via socket
- GM per-user code management (save, regenerate, revoke)

#### `_setupScenesView(contentEl)` — Line 2170
- Scene selector dropdown
- Token rendering on scene image
- Token drag support
- PinchZoom initialization

#### `_setupNavView(contentEl)` — Line 2963
- Nav marker placement (click on map, GM only)
- Route path rendering (SVG)
- Ship position on route
- Heading/speed/fuel/ETA display
- Marker type selector

#### `_setupEmergencyView(contentEl)` — Line 4793
- Self-destruct sequence (countdown, voice warnings)
- Evacuation, lockdown, distress, atmosphere purge, bioalert
- Trigger dialogs with confirmation
- Cancel buttons
- Voice synthesis for warnings

#### `_setupSettingsView(contentEl)` — Line 5502
- Ship profile switching
- CRT effect controls (scanlines, flicker)
- MU/TH/UR plugin selector
- Crew folder filter
- API settings
- Save/apply

---

## Clearance & Authentication

### Methods

| Method | Line | Purpose |
|--------|------|---------|
| `_loadUserCommandCode(userId)` | 4600 | Load a specific user's code |
| `_loadAllUserCommandCodes()` | 4611 | Load all codes (for validation) |
| `_getActiveClearance()` | 4633 | Get current user's clearance |
| `_getPlayerClearance()` | 4646 | Get player-facing clearance |
| `_getClearanceRank(level)` | 4653 | Convert level string to numeric rank |
| `_setActiveClearance(level, userId)` | 4657 | Set clearance (GM writes setting) |
| `_canAccessClassification(class, clearance)` | 4671 | Check if clearance grants access |
| `_tryCommandCodeInMuthur(input)` | 4705 | Handle code entry in MU/TH/UR chat |
| `_updateFooterClearance(level)` | 4585 | Update footer badge display |

### Clearance Rank Map

```javascript
static CLEARANCE_RANK = {
  'NONE': 0,
  'CREWMEMBER': 0,
  'MEDICAL': 1,
  'CAPTAIN': 2,
  'CORPORATE': 3,
  'MASTER_OVERRIDE': 4,
};
```

---

## Emergency Protocols

The emergency system (GM only) supports five protocols:

| Protocol | Method | Effect |
|----------|--------|--------|
| Self-Destruct | `_armSelfDestruct()` | Countdown timer, voice warnings, status button flash |
| Evacuation | `_activateEmergency('evacuation')` | Crew alert, recurring voice |
| Lockdown | `_activateEmergency('lockdown')` | Section isolation |
| Distress | `_activateEmergency('distress')` | Beacon activation |
| Atmosphere Purge | `_showAtmospherePurgeDialog()` | Deck-specific purge |

Each protocol:
- Shows a confirmation dialog
- Broadcasts an alert to all player terminals
- Plays emergency sounds
- Starts recurring voice warnings (Web Speech API)
- Flashes the STATUS nav button red
- Can be cancelled by the GM

---

## Event Timers

The timer system tracks events against the in-game clock:

```javascript
// Timer structure
{
  id: 'abc123',
  label: 'FTL JUMP',
  category: 'navigation',
  gameTargetTime: 6729571200000,  // game-clock epoch ms
  createdAt: 1708560000000,
  status: 'active',              // active | completed | cancelled
  actions: [
    { type: 'log', sender: 'NAV', subject: 'FTL JUMP COMPLETE' },
    { type: 'broadcast', message: 'FTL TRANSITION COMPLETE' },
    { type: 'sound', sound: 'alert' },
  ],
}
```

**Key methods:** `_createEventTimer()`, `_cancelEventTimer()`, `_tickEventTimers()`, `_executeTimerActions()`, `_ensureDefaultEtaTimer()`

---

## Utility Methods

| Method | Line | Purpose |
|--------|------|---------|
| `_normalizeCrtSetting(val)` | 6348 | Normalize scanline/flicker strings |
| `_getMuthurHeader()` | 6357 | Get AI name from plugin config |
| `_getGameDate()` | 6369 | Format in-game date |
| `_getGameClockDate()` | 6377 | Get current game clock time |
| `_getDisplayTitle()` | 6410 | Build ship display title |
| `_buildAudioWaveformPlayer()` | 6443 | Create audio player with waveform viz |
| `_fmtAudioTime(secs)` | 6719 | Format seconds as MM:SS |
| `_loadSetting(key)` | 6725 | Safe setting read with fallback |
| `_addLog(...)` | 6733 | Add a log entry to settings |
| `_broadcastSocket(type, payload)` | 6752 | Emit on module socket channel |

---

## Adding a New View

To add a new view to the terminal:

### 1. Create the template

Create `templates/views/myview.hbs`:

```handlebars
<div class="wy-view-myview">
  <div class="wy-section-title">MY VIEW TITLE</div>
  <div class="wy-border-box">
    {{!-- Your content here --}}
    <div style="color: var(--wy-green);">{{myData.message}}</div>
  </div>
</div>
```

### 2. Add the data provider

In `terminal-app.mjs`, add a case to `_getViewData()` (~line 415):

```javascript
case 'myview':
  return { ...base, myData: this._getMyViewData() };
```

Add the data method:

```javascript
_getMyViewData() {
  return {
    message: 'HELLO FROM MY VIEW',
    items: game.settings.get('wy-terminal', 'myItems') || [],
  };
}
```

### 3. Add the setup method

Add a case to `_onViewRendered()` (~line 1492):

```javascript
case 'myview': this._setupMyView(contentEl); break;
```

Add the setup method:

```javascript
_setupMyView(contentEl) {
  contentEl.querySelector('[data-action="do-thing"]')?.addEventListener('click', () => {
    // Handle click
  });
}
```

### 4. Add the navigation button

In `getData()` (~line 103), add to the `navButtons` array:

```javascript
{ view: 'myview', icon: '◆', label: 'MY VIEW' }
```

### 5. Register the template

In `wy-terminal.mjs`, add to the `loadTemplates()` array:

```javascript
'modules/wy-terminal/templates/views/myview.hbs',
```

### 6. Add CSS

In `styles/terminal.css`, add styles for `.wy-view-myview`:

```css
.wy-view-myview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
```
