# Customization Guide

How to customize, extend, and override WY-Terminal for your own scenarios.

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Changing Ship Identity](#changing-ship-identity)
- [Adding a New Ship Profile](#adding-a-new-ship-profile)
- [Creating a New Scenario Plugin](#creating-a-new-scenario-plugin)
- [Adding a New View](#adding-a-new-view)
- [Modifying AI Prompts](#modifying-ai-prompts)
- [Managing Story Flags at Runtime](#managing-story-flags-at-runtime)
- [Customizing CRT Theme & Styles](#customizing-crt-theme--styles)
- [Adding Sound Effects](#adding-sound-effects)
- [GM Command Macros](#gm-command-macros)
- [Overriding Ship Data via Console](#overriding-ship-data-via-console)
- [Overriding Styles](#overriding-styles)
- [Extending with Another Module](#extending-with-another-module)

---

## Quick Reference

| Task | Where to Change |
|------|----------------|
| Ship name/class/registry | Module Settings or `game.settings.set()` |
| AI model/provider | Module Settings → API Base URL, API Key, AI Model |
| Scenario plugin | Module Settings → MU/TH/UR Scenario Plugin |
| AI personality | `muthur/prompts/prompt_prefix.txt` |
| Scenario lore | `muthur/plugins/{name}/prompts/{name}_prompt.txt` |
| Story flags | `muthur/plugins/{name}/config.json` → `prompt_updates` |
| Ship systems defaults | `scripts/ship-profiles.mjs` → `defaultSystems` |
| Crew defaults | `scripts/ship-profiles.mjs` → `defaultCrew` |
| Cargo defaults | `scripts/ship-profiles.mjs` → `defaultCargo` |
| CRT visual effects | Module Settings → Scanlines, CRT Flicker |
| Terminal sounds | `muthur/sounds/` directory |
| CSS overrides | Custom CSS module or `styles/terminal.css` |
| New views | `scripts/terminal-app.mjs` + `templates/views/` + navigation |
| New settings | `scripts/settings.mjs` |

---

## Changing Ship Identity

The simplest customization — change what's displayed in the terminal header.

### Via Module Settings

Open FoundryVTT → Settings → Module Settings → WY-Terminal:
- **Ship Name**: `USCSS EUROPA`
- **Ship Class**: `R-CLASS RESEARCH VESSEL`
- **Ship Registry**: `REG# 440-1234567`
- **Mission Name**: `OPERATION PROMETHEUS`

### Via Console / Macro

```javascript
await game.settings.set('wy-terminal', 'shipName', 'USCSS EUROPA');
await game.settings.set('wy-terminal', 'shipClass', 'R-CLASS RESEARCH VESSEL');
await game.settings.set('wy-terminal', 'shipRegistry', 'REG# 440-1234567');
await game.settings.set('wy-terminal', 'missionName', 'OPERATION PROMETHEUS');
```

---

## Adding a New Ship Profile

Ship profiles define default systems, crew, cargo, and UI theme. They live in `scripts/ship-profiles.mjs`.

```javascript
// Add to the SHIP_PROFILES object:
europa: {
  id: 'europa',
  name: 'USCSS EUROPA',
  shipClass: 'R-CLASS RESEARCH VESSEL',
  registry: 'REG# 440-1234567',
  owner: 'WEYLAND-YUTANI CORP.',
  interfaceVersion: '2042',
  uiTheme: 'modern',           // 'modern' (green) or 'legacy' (amber tint)
  muthurModel: '9000 SERIES',
  mission: 'ZETA RETICULI SURVEY',
  defaultPlugin: 'europa',      // Links to MU/TH/UR plugin

  defaultSystems: [
    { name: 'REACTOR',      status: 'ONLINE', detail: 'NOMINAL',     powerPct: 100 },
    { name: 'LIFE SUPPORT', status: 'ONLINE', detail: 'O2/CO2 NOM',  powerPct: 100 },
    { name: 'ENGINES',      status: 'ONLINE', detail: 'FTL STANDBY', powerPct: 100 },
    // ...add all ship systems
  ],

  defaultCrew: [
    { name: 'CHEN',   role: 'CAPTAIN',  location: 'BRIDGE',  status: 'ACTIVE',
      statusClass: 'online', statusTextClass: 'wy-text-green' },
    // ...add all crew
  ],

  extraNavButtons: [],          // Additional nav buttons: ['weapons', 'science']

  defaultCargo: [
    { name: 'SAMPLE CONTAINMENT UNIT', qty: 12, category: 'EQUIPMENT',
      location: 'LAB', description: 'Sealed sample containers...' },
    // ...
  ],
},
```

The ship profile is selected via the `activeShip` setting or from the in-terminal GM settings panel.

---

## Creating a New Scenario Plugin

See **[plugins.md](plugins.md)** for the complete step-by-step guide. Quick summary:

1. Create `muthur/plugins/{name}/config.json` with flags and prompt_updates
2. Create `muthur/plugins/{name}/prompts/{name}_prompt.txt` with scenario lore
3. Register in `PLUGIN_REGISTRY` (muthur-engine.mjs) and settings choices (settings.mjs)
4. Optionally create a matching ship profile in ship-profiles.mjs

---

## Adding a New View

See **[terminal-app.md](terminal-app.md#adding-a-new-view)** for the detailed walkthrough. Quick summary:

### 1. Create the Template

`templates/views/myview.hbs`:
```handlebars
<div class="wy-view-myview">
  <div class="wy-section-header">MY CUSTOM VIEW</div>
  <div class="wy-section-body">
    {{#each items}}
      <div class="wy-data-row">{{this.label}}: {{this.value}}</div>
    {{/each}}
  </div>
</div>
```

### 2. Register the Template

In `scripts/wy-terminal.mjs`, add to the `loadTemplates()` array:
```javascript
'modules/wy-terminal/templates/views/myview.hbs',
```

### 3. Add Data Provider

In `terminal-app.mjs`, add a case to `_getViewData()`:
```javascript
case 'myview':
  return { items: [{ label: 'STATUS', value: 'NOMINAL' }] };
```

### 4. Add Setup Method

```javascript
_setupMyViewView(html) {
  // Wire up event listeners, dynamic behavior
  html.find('.wy-data-row').on('click', (ev) => { /* ... */ });
}
```

### 5. Add Navigation Button

In `_getNavButtons()` or the template, add a nav entry:
```javascript
{ view: 'myview', label: 'MY VIEW', icon: 'fa-cog' }
```

---

## Modifying AI Prompts

### Change the AI Persona (All Scenarios)

Edit `muthur/prompts/prompt_prefix.txt`. This controls how MU/TH/UR speaks — terse 1980s terminal style, response length, formatting rules.

Example change — make it more verbose:
```text
// Change this:
Keep your answers short, unless the players explicitly request otherwise.
Maybe a sentence or two.

// To this:
Provide moderately detailed responses of 3-5 sentences. Include relevant
technical data when available.
```

### Change Scenario-Specific Content

Edit `muthur/plugins/{name}/prompts/{name}_prompt.txt`. This is where ship lore, crew details, mission briefing, and classified information live.

### Add Conditional Story Content

Add entries to `prompt_updates` in the plugin's `config.json`:
```json
{
  "alien_sighted": false,
  "prompt_updates": {
    "alien_sighted": "ALERT: Unknown biological organism has been sighted on Deck C. Crew should exercise extreme caution. Recommend quarantine protocols."
  }
}
```

---

## Managing Story Flags at Runtime

Toggle flags during gameplay to advance the narrative:

```javascript
// Toggle a flag (flips true↔false)
game.wyTerminal.sendGmCommand({ type: 'update_flag', flag: 'docked_with_cronus' });

// Set a flag to a specific value
game.wyTerminal.sendGmCommand({ type: 'set_flag', flag: 'alien_sighted', value: true });

// Add a temporary condition (doesn't persist in config)
game.wyTerminal.sendGmCommand({
  type: 'add_prompt_context',
  alert_type: 'fire',
  location: 'Engineering',
  context: 'Active fire in Engineering section. Sprinkler system engaged.'
});

// Clear a condition
game.wyTerminal.sendGmCommand({
  type: 'clear_condition',
  alert_type: 'fire',
  location: 'Engineering'
});
```

---

## Customizing CRT Theme & Styles

### Scanlines & Flicker

Via Module Settings or console:
```javascript
await game.settings.set('wy-terminal', 'scanlines', 'heavy');  // off, light, medium, heavy
await game.settings.set('wy-terminal', 'crtFlicker', 'light');  // off, light, medium, heavy
```

### CSS Custom Properties

The terminal uses CSS variables throughout. Override them in a custom CSS file or module:

```css
/* Override the terminal green color */
:root {
  --wy-green: #00ff41;
  --wy-green-dim: #005f15;
  --wy-green-bright: #7fff00;
  --wy-bg: #0a0a0a;
  --wy-border: #1a3a00;
}
```

### Color Themes

The terminal supports `modern` (green phosphor) and `legacy` (amber tint) themes via the ship profile's `uiTheme` property. To add a new theme, add CSS rules targeting a data attribute:

```css
[data-ui-theme="bluescreen"] {
  --wy-green: #00aaff;
  --wy-green-dim: #003366;
  --wy-border: #004488;
}
```

---

## Adding Sound Effects

Sound files are WAV format in `muthur/sounds/`. Existing sounds:

| File | Used For |
|------|----------|
| `beep.wav` | UI interactions |
| `boot.wav` | Boot sequence |
| `buzz.wav` | Error/denied |
| `horn.wav` | Emergency alerts |
| `klaxon.wav` | Self-destruct alarm |
| `voice_*.wav` | Voice announcements |

### Adding a New Sound

1. Place your WAV file in `muthur/sounds/`:
   ```
   muthur/sounds/my_alert.wav
   ```

2. Play it via GM command:
   ```javascript
   game.wyTerminal.sendGmCommand({ type: 'play_sound', sound: 'my_alert' });
   ```

3. Or use it in a broadcast:
   ```javascript
   game.wyTerminal.sendGmCommand({
     type: 'broadcast',
     message: 'PROXIMITY ALERT',
     sound: 'my_alert'
   });
   ```

---

## GM Command Macros

Create FoundryVTT macros for common GM actions:

### Broadcast Alert

```javascript
game.wyTerminal.sendGmCommand({
  type: 'broadcast',
  message: 'HULL BREACH DETECTED — DECK C\nEMERGENCY BULKHEADS SEALED',
  sound: 'horn'
});
```

### Inject Scripted Response

```javascript
game.wyTerminal.sendGmCommand({
  type: 'inject_response',
  message: 'UNABLE TO COMPLY.\nNAVIGATION SYSTEMS LOCKED BY CORPORATE OVERRIDE.\nCONTACT COMPANY REPRESENTATIVE.'
});
```

### Switch Scene Mid-Game

```javascript
// Switch from Montero to Cronus scenario
game.wyTerminal.sendGmCommand({ type: 'switch_plugin', plugin: 'cronus' });
```

### Toggle Story Beat

```javascript
game.wyTerminal.sendGmCommand({ type: 'update_flag', flag: 'docked_with_cronus' });
```

### Update Ship System

```javascript
// Damage the reactor
const systems = game.settings.get('wy-terminal', 'shipSystems');
const reactor = systems.find(s => s.name === 'REACTOR');
if (reactor) {
  reactor.status = 'CRITICAL';
  reactor.detail = 'CONTAINMENT FAILURE';
  reactor.powerPct = 15;
  await game.settings.set('wy-terminal', 'shipSystems', systems);
  game.socket.emit('module.wy-terminal', { type: 'refreshView', payload: { view: 'status' } });
}
```

### Add a Log Entry

```javascript
const logs = game.settings.get('wy-terminal', 'logEntries');
logs.push({
  timestamp: '2183-03-15 08:45',
  sender: 'MU/TH/UR',
  subject: 'ANOMALOUS READING DETECTED',
  detail: 'Sensor array has detected an anomalous energy signature at bearing 045.',
  classification: 'CAPTAIN'  // Only visible at CAPTAIN clearance or higher
});
await game.settings.set('wy-terminal', 'logEntries', logs);
game.socket.emit('module.wy-terminal', { type: 'refreshView', payload: { view: 'logs' } });
```

---

## Overriding Ship Data via Console

All ship data is stored in Foundry settings and can be read/written from the browser console:

```javascript
// Read current systems
game.settings.get('wy-terminal', 'shipSystems');

// Read crew roster
game.settings.get('wy-terminal', 'crewRoster');

// Read cargo manifest
game.settings.get('wy-terminal', 'cargoManifest');

// Read navigation data
game.settings.get('wy-terminal', 'navData');

// Read log entries
game.settings.get('wy-terminal', 'logEntries');

// Write any of these (GM only):
await game.settings.set('wy-terminal', 'crewRoster', [
  { name: 'CHEN', role: 'CAPTAIN', location: 'BRIDGE', status: 'ACTIVE',
    statusClass: 'online', statusTextClass: 'wy-text-green' },
  // ...
]);

// Force all clients to refresh:
game.socket.emit('module.wy-terminal', { type: 'refreshView', payload: {} });
```

---

## Overriding Styles

### Method 1 — CSS Override Module

Create a minimal FoundryVTT module that loads a CSS file after WY-Terminal:

```json
{
  "id": "my-terminal-theme",
  "title": "My Terminal Theme",
  "styles": ["styles/overrides.css"],
  "relationships": {
    "requires": [{ "id": "wy-terminal", "type": "module" }]
  }
}
```

In `styles/overrides.css`:
```css
/* Override terminal font */
.wy-terminal-app {
  font-family: 'IBM Plex Mono', monospace !important;
}

/* Change header color */
.wy-header {
  border-bottom-color: #ff6600 !important;
}

/* Custom nav button styling */
.wy-nav-btn.active {
  background: rgba(255, 102, 0, 0.2) !important;
  border-color: #ff6600 !important;
}
```

### Method 2 — Direct Edit

Edit `styles/terminal.css` directly. The file is ~3,600 lines organized into sections:
- Root variables and resets (~1–100)
- Layout and shell (~100–400)
- Navigation buttons (~400–600)
- View-specific styles (~600–2500)
- CRT effects (scanlines, flicker) (~2500–2800)
- Animations and keyframes (~2800–3200)
- Responsive / touch (~3200–3600)

---

## Extending with Another Module

If you want to interact with WY-Terminal from another FoundryVTT module:

```javascript
// Check if WY-Terminal is active
if (game.modules.get('wy-terminal')?.active) {

  // Access the terminal API
  const terminal = game.wyTerminal;

  // Open/close
  terminal.open();
  terminal.close();

  // Send GM commands
  terminal.sendGmCommand({ type: 'broadcast', message: 'Hello from my module!' });

  // Read ship data
  const systems = game.settings.get('wy-terminal', 'shipSystems');

  // Listen for terminal events via socket
  game.socket.on('module.wy-terminal', (data) => {
    if (data.type === 'statusUpdate') {
      console.log('Ship status changed:', data.payload);
    }
  });
}
```
