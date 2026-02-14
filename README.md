# Weyland-Yutani Ship Terminal

A FoundryVTT module that provides an interactive green-screen CRT terminal interface for the **AlienRPG** game system. Designed for **Chariots of the Gods** and other Alien RPG scenarios [future work].

![Terminal Interface](screenshots/terminal-preview.png)

## Features

- **Authentic CRT Aesthetic** — Green phosphor text on black, scanlines, flicker, and glow effects
- **Weyland-Yutani Branding** — Full "INTERFACE 2037" shipboard computer experience
- **Interactive Navigation** — Button panels on both sides for accessing ship subsystems
- **Digital Maps** — View maps with pinch-to-zoom and scroll, independent of navigation
- **MU/TH/UR AI Engine** — Built-in OpenAI-powered ship AI with scenario-aware prompts
- **Scenario Plugins** — Montero, Cronus, Cronus Life Support, Fort Nebraska (A.P.O.L.L.O.)
- **GM Commands** — Send broadcasts, inject responses, update story flags, control self-destruct via sockets
- **Foundry Scene Viewer** — Display any Foundry scene inside the terminal frame
- **Ship Status Tracking** — JSON-based status that syncs across all clients
- **Touch Screen Support** — Full touch support including pinch-zoom for tablets/touch monitors
- **Real-time Sync** — All status updates broadcast to all connected players via sockets
- **MuthurGPT Integration** — Export ship status as JSON files muthurGPT can reference

## Installation

### Manual Install 
1. Copy the `wy-terminal` folder into your FoundryVTT `Data/modules/` directory
2. Enable the module in your World settings: **Settings → Manage Modules → Weyland-Yutani Ship Terminal**
3. The module requires the **AlienRPG** (Alien Evolved) game system

### Manifest URL
Use this URL in Foundry's "Install Module" dialog:
```
https://raw.githubusercontent.com/BenTheCloudGuy/foundryvtt-alienrpg-module/main/module.json
```

## Usage

### Opening the Terminal
- Click the **terminal icon** (⌨) in the scene controls toolbar (Token Controls section)
- Or run the macro: `game.wyTerminal.open()`
- Or toggle: `game.wyTerminal.toggle()`

### Navigation
The terminal has button columns on the left and right sides:

| Button | Description |
|--------|-------------|
| **STATUS** | Ship overview — vessel info and system summary |
| **CREW** | Crew manifest with location and status tracking |
| **SYSTEMS** | Detailed systems diagnostic with power distribution |
| **LOGS** | Ship log entries (warning/critical highlighting) |
| **MAPS** | Digital maps with pinch-zoom support |
| **NAV** | Navigation & stellar cartography |
| **EMERGENCY** | Self-destruct, evacuation, lockdown, distress |
| **MU/TH/UR** | AI interface — iframe or built-in chat |
| **COMMS** | Communications array status |
| **CARGO** | Cargo manifest |
| **SCENES** | Foundry scene viewer |
| **CONFIG** | Terminal settings |

### MU/TH/UR Integration

The terminal supports three modes for the MU/TH/UR AI:

#### Engine Mode (Recommended)
Set an **OpenAI API Key** and select a **Scenario Plugin** in Configuration. The engine:
- Loads scenario-specific prompts (ship lore, crew details, story beats)
- Calls OpenAI directly from the browser via `fetch()`
- Supports GM commands to inject responses, toggle story flags, and broadcast alerts
- Maintains conversation history per session

Available plugins: `montero`, `cronus`, `cronus_life_support`, `fort_nebraska`

#### Iframe Mode
Set the **MU/TH/UR Server URL** in settings to embed an external muthurGPT web interface directly.

#### GM Relay Mode
When no API key or URL is configured:
- **Players** type queries that get relayed to the GM via socket
- **GM** receives a dialog popup to respond as MU/TH/UR
- Chat history persists across sessions

### GM Commands

From the browser console or Foundry macros:

```javascript
// Broadcast alert to all players
game.wyTerminal.sendGmCommand({ type: 'broadcast', message: 'HULL BREACH DETECTED', sound: 'horn' });

// Inject a scripted MU/TH/UR response (replaces AI for next query)
game.wyTerminal.sendGmCommand({ type: 'inject_response', message: 'ACCESS DENIED. CLEARANCE LEVEL INSUFFICIENT.' });

// Toggle a story flag (rebuilds the AI system prompt)
game.wyTerminal.sendGmCommand({ type: 'update_flag', flag: 'docked_with_cronus' });

// Switch scenario plugin mid-game
game.wyTerminal.sendGmCommand({ type: 'switch_plugin', plugin: 'cronus_life_support' });

// Self-destruct
game.wyTerminal.sendGmCommand({ type: 'start_self_destruct' });
game.wyTerminal.sendGmCommand({ type: 'cancel_self_destruct' });

// Add dynamic context the AI will know about
game.wyTerminal.sendGmCommand({
  type: 'add_prompt_context',
  alert_type: 'xenomorph',
  location: 'CARGO BAY',
  context: 'A hostile organism has been detected in the cargo bay.'
});
```

### Ship Status & MuthurGPT Sync

The terminal can export ship status as JSON files that muthurGPT reads:

```javascript
// Export status for muthurGPT
await game.wyTerminal.status.exportStatusFile();

// Import a muthurGPT save file
await game.wyTerminal.status.importStatusFile('path/to/save.json');
```

### Adding Maps

Maps can be added via the API:
```javascript
await game.wyTerminal.status.addMap('cronus-a', 'CRONUS DECK A', 'modules/wy-terminal/maps/cronus-deck-a.png');
await game.wyTerminal.status.addMap('cronus-b', 'CRONUS DECK B', 'modules/wy-terminal/maps/cronus-deck-b.png');
```

### Updating Crew & Systems (GM)

```javascript
// Update crew member
await game.wyTerminal.status.updateCrewMember('MILLER', { 
  location: 'MEDBAY', 
  status: 'INJURED' 
});

// Update ship system
await game.wyTerminal.status.updateSystem('ENGINES', { 
  status: 'OFFLINE', 
  detail: 'COLLISION DAMAGE' 
});

// Add log entry
await game.wyTerminal.status.addLog('MU/TH/UR', 'PROXIMITY ALERT — UNIDENTIFIED VESSEL', 'warning');
```

### Pinch-Zoom

The central display frame supports:
- **Mouse wheel** — Zoom in/out centered on cursor
- **Pinch gesture** — Two-finger pinch on touch screens
- **Drag to pan** — Click-drag (mouse) or single-finger drag (touch) when zoomed
- **Toolbar buttons** — `+`, `−`, `⊡` (reset) in the display toolbar

The zoom only affects the display frame content — navigation buttons remain fixed.

## Compendium Packs

The module includes compendium packs migrated from the AlienRPG world data:

| Pack | Type | Records | Contents |
|------|------|---------|----------|
| **AlienRPG Actors** | Actor | 158 | Characters, Creatures, Spacecraft, Vehicles, Synthetics |
| **AlienRPG Items** | Item | 286 | Weapons, Armor, Talents, Agendas, Colony Initiatives, Skills |
| **AlienRPG Scenes** | Scene | 6 | Montero, Cronus Decks A-D, CotG Cover |
| **AlienRPG Macros** | Macro | 7 | Dice rollers, table rollers, utility macros |
| **AlienRPG Journal** | JournalEntry | 80 | Scenario text, handouts, rules reference, artwork |
| **AlienRPG Tables** | RollTable | 60+ | Attack tables, critical injuries, panic, colony generation |

> **Note:** Scene backgrounds reference images from the `alienrpg-starterset` module. Make sure that module is also installed for scene maps to display correctly.

## Settings

| Setting | Scope | Description |
|---------|-------|-------------|
| Ship Name | World | Vessel name displayed in header |
| Ship Class | World | Class designation |
| Ship Registry | World | Registration number |
| Mission Name | World | Current mission |
| OpenAI API Key | World | API key for MU/TH/UR AI engine (GM only) |
| AI Model | World | OpenAI model (e.g. `gpt-4o-mini`) |
| Scenario Plugin | World | Which ship/scenario prompts to load |
| MU/TH/UR URL | World | External muthurGPT URL (optional) |
| Status Path | World | Foundry data path for status JSON files |
| CRT Scanlines | Client | Enable/disable scanline overlay |
| CRT Flicker | Client | Enable/disable flicker animation |
| Sound Effects | Client | Enable/disable terminal sounds |
| Terminal Width | Client | Window width in pixels |
| Terminal Height | Client | Window height in pixels |

## File Structure

```
wy-terminal/
├── module.json              # FoundryVTT module manifest
├── packs/                   # Compendium packs (LevelDB)
│   ├── actors/              # Characters, creatures, vehicles, spacecraft
│   ├── items/               # Weapons, armor, talents, agendas, etc.
│   ├── scenes/              # Game scenes with tokens, walls, lights
│   ├── macros/              # Dice roller and utility macros
│   ├── journal/             # Scenario text, handouts, rules
│   └── tables/              # Roll tables (attacks, injuries, panic, etc.)
├── scripts/
│   ├── wy-terminal.mjs      # Entry point — hooks, settings, globals
│   ├── terminal-app.mjs     # Main Application class
│   ├── muthur-engine.mjs    # OpenAI-powered AI engine
│   ├── muthur-bridge.mjs    # MU/TH/UR communication bridge
│   ├── ship-status.mjs      # Ship status manager
│   ├── pinch-zoom.mjs       # Touch/mouse zoom & pan handler
│   └── settings.mjs         # Module settings registration
├── muthur/
│   ├── config.json          # Base engine configuration
│   ├── prompts/             # Shared prompt prefix/suffix
│   ├── sounds/              # Atmospheric .wav sound effects
│   ├── ascii/               # ASCII art assets
│   └── plugins/             # Scenario plugins
│       ├── montero/         # USCSS Montero (Chariots of the Gods)
│       ├── cronus/          # USCSS Cronus
│       ├── cronus_life_support/
│       └── fort_nebraska/   # Fort Nebraska (A.P.O.L.L.O.)
├── styles/
│   └── terminal.css         # Green-screen CRT styling
├── templates/
│   ├── terminal.hbs         # Main terminal layout
│   └── views/               # Individual view templates
├── status/
│   └── default-status.json  # Default ship status template
└── lang/
    └── en.json              # English localization
```

## Compatibility

- **FoundryVTT:** v13+
- **Game System:** AlienRPG (Alien Evolved) v4.0.0+
- **Browsers:** Chrome, Firefox, Edge, Safari (including mobile)
- **Touch Devices:** Full support for tablets and touch monitors

## License

This module is designed for personal use with the Alien RPG tabletop roleplaying game by Free League Publishing.
Alien RPG is © Free League Publishing. Weyland-Yutani is a fictional corporation from the Alien franchise.
