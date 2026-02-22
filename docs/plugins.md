# Plugin System — Scenario Authoring Guide

> **Directory:** `muthur/plugins/`

Plugins define scenario-specific AI behavior, ship lore, crew, systems, and conditional story beats. Each plugin corresponds to a ship or installation that MU/TH/UR (or A.P.O.L.L.O.) represents.

---

## Table of Contents

- [How Plugins Work](#how-plugins-work)
- [Plugin Directory Structure](#plugin-directory-structure)
- [Plugin Registry](#plugin-registry)
- [config.json Schema](#configjson-schema)
- [Prompt Files](#prompt-files)
- [prompt_updates — Conditional Story Beats](#prompt_updates--conditional-story-beats)
- [Shared Prompts (Prefix & Suffix)](#shared-prompts-prefix--suffix)
- [Built-In Plugins](#built-in-plugins)
- [Creating a New Plugin](#creating-a-new-plugin)

---

## How Plugins Work

When MuthurEngine initializes, it:

1. Loads `muthur/config.json` (base config)
2. Loads `muthur/plugins/{pluginName}/config.json` (scenario config — merged over base with `Object.assign`)
3. Builds the system prompt: `prompt_prefix.txt` + `{pluginName}_prompt.txt` + active `prompt_updates` + `prompt_suffix.txt`
4. Restores the plugin's conversation history (if any)

The active plugin is determined by the `muthurPlugin` Foundry setting (default: `'cronus'`).

---

## Plugin Directory Structure

```
muthur/plugins/{plugin-name}/
├── config.json                    # Scenario configuration
├── prompts/
│   └── {plugin-name}_prompt.txt   # Scenario-specific system prompt
└── ascii/                         # Optional: ASCII art files (deck maps, logos)
    └── *.txt
```

Example — Montero plugin:
```
muthur/plugins/montero/
├── config.json
└── prompts/
    └── montero_prompt.txt
```

---

## Plugin Registry

Every plugin must be registered in the `PLUGIN_REGISTRY` constant at the top of `scripts/muthur-engine.mjs`:

```javascript
const PLUGIN_REGISTRY = {
  montero: {
    name: 'montero',
    label: 'USCSS Montero',        // Display name in settings dropdown
    headerName: 'MU/TH/UR 6500',   // Header text in MU/TH/UR view
  },
  // ...
};
```

And as a choice in the `muthurPlugin` setting in `scripts/settings.mjs`:

```javascript
game.settings.register('wy-terminal', 'muthurPlugin', {
  // ...
  choices: {
    montero: 'USCSS Montero',
    cronus: 'USCSS Cronus',
    cronus_life_support: 'USCSS Cronus (Life Support)',
    fort_nebraska: 'Fort Nebraska',
    my_new_plugin: 'My New Ship',  // ← Add your plugin here
  },
});
```

---

## config.json Schema

The plugin `config.json` is merged over the base `muthur/config.json`. All fields are optional — the base config provides defaults.

```jsonc
{
  // ── Display ──
  "header_name": "MU/TH/UR 6500",        // Header text in MU/TH/UR view
  "game_time": "2183-03-15 07:30",        // Initial in-game date/time

  // ── Story Flags ──
  // Boolean flags that control conditional prompt_updates.
  // GMs toggle these at runtime to advance the story.
  "unknown_signal_detected": true,
  "docked_with_cronus": false,
  "montero_self_destruct_active": false,

  // ── Conditional Prompt Text ──
  // When the corresponding flag above is true, this text is appended to the system prompt.
  "prompt_updates": {
    "unknown_signal_detected": "An unknown emergency distress signal has been detected...",
    "docked_with_cronus": "The Montero has successfully docked with the USCSS Cronus..."
  },

  // ── Crew (used by legacy muthurGPT, also available to telemetry) ──
  "crew": [
    {
      "id": "miller",
      "name": "Captain Miller",
      "role": "Captain",
      "location": "Bridge",
      "status": "Active",
      "task": null,
      "task_eta": null
    }
  ],

  // ── Ship Systems (legacy) ──
  "ship_systems": {
    "life_support": "Online",
    "main_power": "Online",
    "engines_ftl": "Online"
  },

  // ── Ship Locations ──
  "ship_locations": [
    "Bridge", "Crew Quarters", "Med Bay", "Engineering", "Cargo Bay"
  ],

  // ── Travel Times (legacy — minutes between locations) ──
  "travel_times": {
    "default": 1,
    "Bridge-Engineering": 3,
    "Bridge-Cargo Bay": 2
  },

  // ── Ship Logs ──
  "ship_logs": [
    {
      "timestamp": "2183-03-15 05:45",
      "type": "priority",              // priority, routine, personal, medical, etc.
      "author": "NETWORK COMCON",
      "subject": "SPECIAL ORDER 966",
      "requires_code": "wilson_command", // Optional: requires this command code to view
      "message": "TO: USCSS MONTERO — AGENT WILSON..."
    }
  ],

  // ── Command Codes (legacy — per-character codes stored in plugin) ──
  "command_codes": {
    "miller_command": {
      "code": "0025565535",
      "user": "Vanessa Miller",
      "clearance": "CAPTAIN"
    },
    "wilson_command": {
      "code": "0008349611",
      "user": "John Wilson",
      "clearance": "CORPORATE"
    }
  },

  // ── Menu Options (legacy — for standalone muthurGPT) ──
  "menu_options": [
    { "key": "1", "label": "CREW STATUS", "command": "crew_status" }
  ]
}
```

**Note:** Many of these fields (`crew`, `ship_systems`, `ship_logs`, `command_codes`) are from the original muthurGPT codebase. In WY-Terminal, the primary data sources are Foundry settings (`shipSystems`, `crewRoster`, `logEntries`, `userCommandCodes`). The plugin config values serve as reference data for the AI prompt and as fallback defaults.

---

## Prompt Files

### Plugin Prompt

**Path:** `muthur/plugins/{name}/prompts/{name}_prompt.txt`

This is the core scenario document. It should include:

- **Identity**: What AI system you are, what ship/installation you're aboard
- **Ship details**: Class, owner, capabilities, current state
- **Mission briefing**: What the crew is doing, where they are, why
- **Key NPCs**: Names, roles, relevant details
- **Environment**: Current conditions, dangers, timeline
- **Response rules**: What the AI can/can't control, how to handle specific queries
- **Classified information**: Corporate secrets gated by command codes

Example structure from the Montero prompt:
```text
In this adventure, you will be the MU/TH/UR 6500 Mainframe terminal
aboard the USCSS Montero.

The USCSS Montero is a Lockmart CM-88G Bison M-Class starfreighter
owned by the Weyland-Yutani Corporation and captained by Vanessa Miller.

[Ship capabilities, cargo, crew status, timeline...]

System statuses are provided via real-time telemetry data injected into
each conversation. Always defer to that data for the current state of
all ship systems.

[Classified information, command codes, special orders...]
```

### Writing Tips

- Use plain text, no markdown formatting (it's injected directly into the AI prompt)
- Be specific about dates, distances, coordinates — the AI will use these literally
- Always include the telemetry instruction: "System statuses are provided via real-time telemetry data..."
- Gate classified info with clear instructions: "The following requires Command Code..."
- Keep it under ~2000 words to leave room for telemetry and conversation in the context window

---

## prompt_updates — Conditional Story Beats

The `prompt_updates` system lets the GM advance the narrative without editing files. Each entry maps a boolean flag name to prompt text:

```json
{
  "docked_with_cronus": false,
  "prompt_updates": {
    "docked_with_cronus": "The Montero has successfully docked with the USCSS Cronus. Access to Cronus Deck A Main Airlock is now available via the docking umbilical."
  }
}
```

### How It Works

1. The flag starts as `false` in config.json
2. During play, the GM toggles it: `game.wyTerminal.sendGmCommand({ type: 'update_flag', flag: 'docked_with_cronus' })`
3. The flag becomes `true`, the prompt text is appended to the system prompt
4. `_rebuildPrompt()` runs, updating the AI's knowledge
5. Future AI responses reflect the new story state

### Multiple Flags

You can have as many flags as needed. They're independent — multiple can be active simultaneously:

```json
{
  "unknown_signal_detected": true,
  "close_enough_to_scan": false,
  "docked_with_cronus": false,
  "montero_self_destruct_active": false,
  "montero_engines_offline": false,
  "prompt_updates": {
    "unknown_signal_detected": "An unknown emergency distress signal...",
    "close_enough_to_scan": "SCAN RANGE ACHIEVED...",
    "docked_with_cronus": "The Montero has successfully docked...",
    "montero_self_destruct_active": "SELF-DESTRUCT SEQUENCE INITIATED...",
    "montero_engines_offline": "Hyperdrive and main propulsion systems are OFFLINE..."
  }
}
```

---

## Shared Prompts (Prefix & Suffix)

### prompt_prefix.txt

**Path:** `muthur/prompts/prompt_prefix.txt`

Shared across ALL plugins. Defines the AI persona, writing style, and core rules:

- Write as an emotionless 1980s computer terminal
- Be terse — one or two sentences unless asked for more
- Never break character
- Use real-time telemetry data as authoritative
- Don't fabricate system statuses that contradict telemetry

### prompt_suffix.txt

**Path:** `muthur/prompts/prompt_suffix.txt`

Final instruction appended after everything else:
```
From now on, my players will be interacting with you, and you will assume the character of MU/TH/UR.
```

### Full Prompt Assembly Order

```
prompt_prefix.txt        ← Persona + rules
{plugin}_prompt.txt      ← Scenario lore
prompt_updates (active)  ← Conditional story beats
prompt_suffix.txt        ← Final instruction
dynamicPrompt            ← Runtime conditions from GM commands
```

---

## Built-In Plugins

| Plugin | Ship/Installation | AI Name | Scenario |
|--------|------------------|---------|----------|
| `montero` | USCSS Montero | MU/TH/UR 6500 | Chariot of the Gods — Act 1 (Montero crew responding to distress signal) |
| `cronus` | USCSS Cronus | MU/TH/UR 2000 | Chariot of the Gods — Act 2 (Exploring the derelict Cronus) |
| `cronus_life_support` | USCSS Cronus | MU/TH/UR 2000 | Chariot of the Gods — Cronus variant with life support failure |
| `fort_nebraska` | Fort Nebraska | A.P.O.L.L.O. | Destroyer of Worlds scenario |

---

## Creating a New Plugin

### Step 1 — Create the Plugin Directory

```bash
mkdir -p muthur/plugins/my_ship/prompts
```

### Step 2 — Write the Prompt File

Create `muthur/plugins/my_ship/prompts/my_ship_prompt.txt`:

```text
In this adventure, you will be the MU/TH/UR 9000 Mainframe terminal
aboard the USCSS Europa.

The USCSS Europa is a Weyland-Yutani deep space research vessel
assigned to survey the Zeta Reticuli system.

[Add ship details, crew, mission, classified info, response rules...]

System statuses are provided via real-time telemetry data injected
into each conversation. Always defer to that data for the current
state of all ship systems.
```

### Step 3 — Create config.json

Create `muthur/plugins/my_ship/config.json`:

```json
{
  "header_name": "MU/TH/UR 9000",
  "game_time": "2187-11-20 14:00",
  
  "initial_event": true,
  "crisis_event": false,
  
  "prompt_updates": {
    "initial_event": "The crew has just been awakened from cryosleep...",
    "crisis_event": "WARNING: Hull breach detected on Deck 3..."
  },
  
  "crew": [
    { "id": "chen", "name": "Commander Chen", "role": "Captain", "location": "Bridge", "status": "Active" }
  ],
  
  "ship_locations": ["Bridge", "Lab", "Engineering", "Medbay", "Cargo Bay"],
  
  "command_codes": {
    "chen_command": {
      "code": "0099887766",
      "user": "Commander Chen",
      "clearance": "CAPTAIN"
    }
  }
}
```

### Step 4 — Register the Plugin

In `scripts/muthur-engine.mjs`, add to `PLUGIN_REGISTRY`:

```javascript
const PLUGIN_REGISTRY = {
  // ...existing plugins...
  my_ship: {
    name: 'my_ship',
    label: 'USCSS Europa',
    headerName: 'MU/TH/UR 9000',
  },
};
```

In `scripts/settings.mjs`, add to the `muthurPlugin` choices:

```javascript
choices: {
  // ...existing choices...
  my_ship: 'USCSS Europa',
},
```

### Step 5 — Optional: Create a Ship Profile

If you want the terminal UI (systems, crew, cargo defaults) to match your ship, add a profile in `scripts/ship-profiles.mjs`:

```javascript
my_ship: {
  id: 'my_ship',
  name: 'USCSS EUROPA',
  shipClass: 'R-CLASS RESEARCH VESSEL',
  registry: 'REG# 440-1234567',
  owner: 'WEYLAND-YUTANI CORP.',
  muthurModel: '9000 SERIES',
  mission: 'ZETA RETICULI SURVEY',
  defaultPlugin: 'my_ship',
  defaultSystems: [
    { name: 'REACTOR', status: 'ONLINE', detail: 'NOMINAL', powerPct: 100 },
    // ...
  ],
  defaultCrew: [
    { name: 'CHEN', role: 'CAPTAIN', location: 'BRIDGE', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
    // ...
  ],
  defaultCargo: [],
},
```

### Step 6 — Optional: Add ASCII Art

Place ASCII art files in `muthur/plugins/my_ship/ascii/`:

```
EUROPA_DECK_A.txt
EUROPA_DECK_B.txt
MY_LOGO.txt
```

Reference them in your prompt with `<IMG:EUROPA_DECK_A>` tags if your template rendering supports it.

### Step 7 — Test

1. Set **MU/TH/UR Scenario Plugin** to your new plugin in Module Settings
2. Open the terminal and navigate to MU/TH/UR
3. Ask questions to verify the AI responds with your scenario context
4. Toggle flags from the console to test prompt_updates:
   ```javascript
   game.wyTerminal.sendGmCommand({ type: 'update_flag', flag: 'crisis_event' });
   ```
