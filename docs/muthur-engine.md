# MU/TH/UR Engine — AI System Reference

> **File:** `scripts/muthur-engine.mjs` (~1,091 lines)

The `MuthurEngine` class handles all AI-powered interactions in the terminal. It assembles scenario-specific system prompts, manages conversation history, calls OpenAI-compatible APIs, processes GM commands via sockets, and injects real-time ship telemetry into every AI conversation — filtered by user clearance level.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Plugin Registry](#plugin-registry)
- [Initialization](#initialization)
- [Prompt Assembly](#prompt-assembly)
- [Messaging Flow](#messaging-flow)
- [Selective Telemetry Injection](#selective-telemetry-injection)
- [Clearance-Gated Filtering](#clearance-gated-filtering)
- [Conversation Management](#conversation-management)
- [GM Commands](#gm-commands)
- [MuthurBridge](#muthurbridge)
- [Key Methods Reference](#key-methods-reference)
- [Customization Points](#customization-points)

---

## Architecture Overview

```
Player types query in MU/TH/UR view
  │
  ▼
MuthurBridge.sendMessage(text)
  │
  ├── ENGINE mode ──► MuthurEngine.getReply(text)
  │                      ├── Check for injected GM response
  │                      ├── Auto-summarize if conversation is long
  │                      ├── Build selective live telemetry context
  │                      ├── Call OpenAI API via fetch()
  │                      └── Return response (with optional uppercase filter)
  │
  ├── IFRAME mode ──► External muthurGPT web UI in iframe
  │
  ├── API mode ───── ► POST to external API endpoint
  │
  └── RELAY mode ──── ► Socket to GM → GM types response manually
```

The engine runs entirely client-side in the browser. There is no server-side proxy — API calls go directly from the player's browser to OpenAI (or a local Ollama instance).

---

## Plugin Registry

Plugins define scenario-specific prompts, configurations, and AI personality. The registry is a static constant at the top of the file:

```javascript
const PLUGIN_REGISTRY = {
  montero: {
    name: 'montero',
    label: 'USCSS Montero',
    headerName: 'MU/TH/UR 6500',
  },
  cronus: {
    name: 'cronus',
    label: 'USCSS Cronus',
    headerName: 'MU/TH/UR 2000',
  },
  cronus_life_support: {
    name: 'cronus_life_support',
    label: 'USCSS Cronus (Life Support)',
    headerName: 'MU/TH/UR 2000',
  },
  fort_nebraska: {
    name: 'fort_nebraska',
    label: 'Fort Nebraska',
    headerName: 'A.P.O.L.L.O.',
  },
};
```

Each plugin corresponds to a directory under `muthur/plugins/{name}/` containing a `config.json` and a `prompts/{name}_prompt.txt` file. See [plugins.md](plugins.md) for the full plugin authoring guide.

---

## Initialization

`initialize(pluginName?)` is called once when the engine first starts (lazily via `MuthurBridge.getEngine()`):

```javascript
async initialize(pluginName = null) {
  this.pluginName = pluginName || game.settings.get('wy-terminal', 'muthurPlugin') || 'cronus';

  // 1. Load base config (muthur/config.json)
  const baseResp = await fetch(`${MUTHUR_PATH}/config.json`);
  this.config = await baseResp.json();

  // 2. Load plugin config (merges over base)
  const pluginResp = await fetch(`${MUTHUR_PATH}/plugins/${this.pluginName}/config.json`);
  Object.assign(this.config, await pluginResp.json());

  // 3. Override with Foundry settings (API key, model, base URL)
  const apiKey = game.settings.get('wy-terminal', 'openaiApiKey');
  if (apiKey) this.config.openai_api_key = apiKey;
  // ...model, baseUrl overrides...

  // 4. Build the system prompt
  await this._buildSystemPrompt();

  // 5. Restore per-plugin conversation or start fresh
  this._restorePluginConversation();

  // 6. Setup socket listener for GM commands
  this._setupSocketListener();
}
```

**Config merge order** (later values override earlier):
1. `muthur/config.json` (base defaults)
2. `muthur/plugins/{name}/config.json` (scenario-specific)
3. Foundry settings (API key, model, base URL)

---

## Prompt Assembly

The system prompt is constructed by `_buildSystemPrompt()` from four layers:

```
┌─────────────────────────────────────┐
│  prompt_prefix.txt                  │  ← Shared persona & rules
│  "Write in the style of an          │
│  emotionless 1980s computer..."     │
├─────────────────────────────────────┤
│  {plugin}_prompt.txt                │  ← Scenario lore, crew, ship details
│  "In this adventure, you will be    │
│  MU/TH/UR 6500 aboard the Montero" │
├─────────────────────────────────────┤
│  prompt_updates (conditional)       │  ← Story beats toggled by GM flags
│  if config.docked_with_cronus:      │
│  "The Montero has docked..."        │
├─────────────────────────────────────┤
│  prompt_suffix.txt                  │  ← Final instruction
│  "From now on, my players will be   │
│  interacting with you..."           │
├─────────────────────────────────────┤
│  dynamicPrompt (runtime)            │  ← Active conditions from GM commands
│  "=== ACTIVE SHIP CONDITIONS ===    │
│  [FIRE] at Engineering: ..."        │
└─────────────────────────────────────┘
```

### prompt_updates — Conditional Story Beats

The plugin `config.json` contains a `prompt_updates` object mapping boolean flag names to prompt text. When a flag is `true` in the config, its text is appended to the system prompt:

```json
{
  "docked_with_cronus": false,
  "montero_self_destruct_active": false,
  "prompt_updates": {
    "docked_with_cronus": "The Montero has successfully docked with the USCSS Cronus...",
    "montero_self_destruct_active": "SELF-DESTRUCT SEQUENCE INITIATED..."
  }
}
```

The GM toggles these flags at runtime via:
```javascript
game.wyTerminal.sendGmCommand({ type: 'update_flag', flag: 'docked_with_cronus' });
```

This toggles the boolean and triggers `_rebuildPrompt()`, which reconstructs the system prompt and updates the first message in the conversation array.

---

## Messaging Flow

`getReply(userInput)` is the main entry point for AI responses:

```
getReply(userInput)
  │
  ├─ Check for injected GM response → return immediately if set
  │
  ├─ Force uppercase if config.force_upper_case is true
  │
  ├─ Check for API key → return error if missing
  │
  ├─ _maybeCompactConversation() → auto-summarize if too many turns
  │
  ├─ _buildLiveShipContext(userInput) → selective telemetry injection
  │   └─ Remove previous live-context message, add fresh one
  │
  ├─ Push user message to conversation
  │
  ├─ Build API request:
  │   ├─ model: config.openai_model or 'gpt-4o-mini'
  │   ├─ messages: conversation array (role + content only)
  │   ├─ temperature: 0.7 (skipped for o1/o3/gpt-5 models)
  │   └─ base URL: config.openai_base_url or 'https://api.openai.com/v1'
  │
  ├─ POST to {baseUrl}/chat/completions
  │
  ├─ Push assistant reply to conversation
  │
  ├─ _savePluginConversation()
  │
  └─ Return reply (uppercase-filtered if configured)
```

**Error handling:** If the API call fails, the user message is popped from the conversation (rollback) and an error message is returned.

---

## Selective Telemetry Injection

Before every AI query, `_buildLiveShipContext(userQuery)` constructs a real-time snapshot of ship state. To reduce token usage, only relevant sections are included based on the user's question.

### Section Detection

`_detectRelevantSections(query)` uses regex patterns to determine which sections to include:

| Section | Trigger Keywords | Example Queries |
|---------|-----------------|-----------------|
| `systems` | STATUS, POWER, ENGINE, REACTOR, LIFE SUPPORT, COMMS, AIRLOCK... | "What is the reactor status?" |
| `crew` | CREW, PERSONNEL, CAPTAIN, MEDIC, ENGINEER, WHO... | "Where is the captain?" |
| `logs` | LOG, ENTRY, REPORT, MESSAGE, RECORD... | "Show me the mission log" |
| `nav` | NAV, COURSE, HEADING, SPEED, ETA, WHERE, POSITION, FUEL... | "Where are we?" |
| `timers` | TIMER, COUNTDOWN, HOW LONG, WHEN, DETONATION... | "How long until detonation?" |
| `cargo` | CARGO, INVENTORY, SUPPLY, EQUIPMENT, MANIFEST... | "What's in the cargo bay?" |

If **no keywords match**, all sections are included as a safe fallback.

Special combo: "SHIP STATUS" or "STORY MOTHER" → includes `systems` + `nav`.

### Telemetry Block Structure

The injected context looks like this in the conversation:

```
=== CURRENT SHIP STATUS — REAL-TIME TELEMETRY ===
THIS DATA IS AUTHORITATIVE. It supersedes ANY conflicting information...
SHIP: USCSS MONTERO — M-CLASS STARFREIGHTER

--- SYSTEMS STATUS ---
  REACTOR: ONLINE (100%) — PWR OUTPUT NOMINAL
  LIFE SUPPORT: ONLINE (100%) — O2/CO2 NOMINAL
  ...

--- CREW MANIFEST ---
  MILLER (CAPTAIN) — STATUS: ACTIVE, LOCATION: BRIDGE
  ...

ACTIVE CLEARANCE LEVEL: CREWMEMBER
NOTE: Telemetry has been filtered to clearance level CREWMEMBER...
=== END REAL-TIME TELEMETRY ===
```

The live context message is tagged with `_liveContext: true` so it can be stripped and replaced on each query.

---

## Clearance-Gated Filtering

The telemetry injection respects the user's clearance level. The engine mirrors the same clearance helpers as `WYTerminalApp`:

```javascript
static CLEARANCE_RANK = {
  'NONE': 0, 'CREWMEMBER': 0, 'MEDICAL': 1,
  'CAPTAIN': 2, 'CORPORATE': 3, 'MASTER_OVERRIDE': 4
};
```

### What Gets Filtered

| Data Type | CREWMEMBER (0) | MEDICAL (1) | CAPTAIN (2) | CORPORATE (3+) |
|-----------|---------------|-------------|-------------|-----------------|
| Systems | Full (except classified) | Full | Full | Full |
| Crew roster | Names + roles only | Full status + location | Full | Full |
| COMPANY AGENT records | `[CORPORATE CLASSIFIED]` | `[CORPORATE CLASSIFIED]` | `[CORPORATE CLASSIFIED]` | Full |
| Classified systems | `[CLASSIFIED]` | `[CLASSIFIED]` | `[CLASSIFIED]` | Full |
| Log entries | Unclassified only | + MEDICAL | + CAPTAIN | All |
| Redacted log count | Shown | Shown | Shown | N/A |

The AI also receives an instruction telling it whether to disclose classified data:
- **CORPORATE+**: "All classified data may be disclosed without requesting additional authorization."
- **Below CORPORATE**: "Do NOT disclose classified data beyond this level. Respond with: ACCESS RESTRICTED — INSUFFICIENT CLEARANCE."

---

## Conversation Management

The engine uses a bounded sliding window to keep token usage manageable:

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_ACTIVE_TURNS` | 8 | Max user+assistant pairs before compaction triggers |
| `SUMMARIZE_THRESHOLD` | 6 | Number of recent turns to keep when compacting |

### Conversation Array Structure

```
[0]  { role: 'system',    content: systemPrompt }           ← Always first
[1]  { role: 'system',    content: summary, _summary: true } ← Optional compressed history
[2+] { role: 'user/assistant', content: ... }                ← Recent turns
[N]  { role: 'system',    content: telemetry, _liveContext: true } ← Refreshed each query
```

### Auto-Compaction Flow

When `_maybeCompactConversation()` detects the conversation has reached `MAX_ACTIVE_TURNS`:

1. Split messages: keep the most recent `SUMMARIZE_THRESHOLD` turns, summarize the rest
2. Call `_summarizeConversation(olderMessages)` — sends a summarization request to `gpt-4o-mini`
3. Merge with any existing summary via `_mergeSummaries()`
4. Rebuild conversation: `system prompt + merged summary + kept turns`

The summarization prompt asks for "terse ship-computer style notes, maximum 200 words" preserving key facts, decisions, and classified information accessed.

### Per-Plugin Isolation

Conversations are stored per-plugin in static Maps:

```javascript
static _pluginConversations = new Map();  // plugin → message array
static _pluginSummaries = new Map();      // plugin → summary string
```

When switching plugins, the current conversation is saved and the target plugin's conversation is restored. This allows switching between Montero and Cronus scenarios without losing context.

### Resetting Conversation

`resetConversation()` clears all cached turns and summaries for the active plugin. This is called when clearance level changes to prevent stale denial patterns from affecting future responses.

---

## GM Commands

GM commands are sent via Foundry sockets and processed by `_processGmCommand(cmd)`. The GM sends commands using:

```javascript
MuthurEngine.sendGmCommand(command);
// or via the WYTerminalApp helper:
game.wyTerminal.sendGmCommand(command);
```

### Command Types

| Command | Payload | Effect |
|---------|---------|--------|
| `broadcast` | `{ message, sound }` | Display alert on all player terminals |
| `inject_response` | `{ message }` | Next player query returns this text instead of AI call |
| `play_sound` | `{ sound }` | Play a WAV file from `muthur/sounds/` |
| `clear_screen` | — | Clear the MU/TH/UR chat display |
| `update_flag` | `{ flag }` | Toggle a boolean config flag and rebuild prompt |
| `set_flag` | `{ flag, value }` | Set a specific flag value and rebuild prompt |
| `add_prompt_context` | `{ context, alert_type, location }` | Add a dynamic condition to the prompt |
| `clear_condition` | `{ alert_type, location? }` | Remove a dynamic condition |
| `switch_plugin` | `{ plugin }` | Switch to a different scenario plugin |
| `update_crew_location` | `{ ... }` | Forwarded to ShipStatusManager |
| `update_ship_system` | `{ ... }` | Forwarded to ShipStatusManager |
| `add_log_entry` | `{ ... }` | Forwarded to ShipStatusManager |
| `start_self_destruct` | — | Forwarded to WYTerminalApp emergency handler |
| `cancel_self_destruct` | — | Forwarded to WYTerminalApp emergency handler |

### Dynamic Conditions

The `add_prompt_context` command builds a dynamic prompt section that is appended to the system prompt:

```javascript
// GM sends:
game.wyTerminal.sendGmCommand({
  type: 'add_prompt_context',
  alert_type: 'fire',
  location: 'Engineering',
  context: 'Fire detected in Engineering. Sprinkler system activated. Temperature rising.',
});

// Produces in the prompt:
// === ACTIVE SHIP CONDITIONS ===
// - [FIRE] at Engineering: Fire detected in Engineering. Sprinkler system activated.
```

Conditions are de-duplicated by `alert_type + location` — sending the same combo replaces the previous entry.

---

## MuthurBridge

> **File:** `scripts/muthur-bridge.mjs` (~271 lines)

`MuthurBridge` is the communication layer between `WYTerminalApp` and the AI backend. It abstracts three operating modes:

| Mode | When | Behavior |
|------|------|----------|
| **ENGINE** | API key is set | Uses `MuthurEngine` directly (default) |
| **IFRAME** | `muthurUrl` points to a web UI | Embeds external muthurGPT in an iframe |
| **API** | `muthurUrl` points to an API endpoint | POSTs to external REST endpoint |
| **RELAY** | No API key or URL configured | Player queries forwarded to GM via socket; GM types responses manually |

Mode detection logic:
```javascript
getMode() {
  const muthurUrl = game.settings.get('wy-terminal', 'muthurUrl');
  if (muthurUrl && !muthurUrl.includes('/api/')) return 'iframe';
  if (apiKey) return 'engine';
  if (muthurUrl && muthurUrl.includes('/api/')) return 'api';
  return 'relay';  // fallback
}
```

### GM Relay Flow

When no AI is configured, the relay mode shows a dialog on the GM's screen with the player's query and a text area for the GM to type a response. The response is sent back via socket. There's a 2-minute timeout after which the player sees "MU/TH/UR IS PROCESSING YOUR REQUEST. PLEASE STAND BY."

---

## Key Methods Reference

| Method | Purpose |
|--------|---------|
| `initialize(pluginName?)` | Load configs, build prompt, restore conversation, setup sockets |
| `_buildSystemPrompt()` | Assemble full system prompt from prefix + plugin + updates + suffix + dynamic |
| `getReply(userInput)` | Main message handler — telemetry injection, API call, conversation management |
| `getGenericMessage()` | Returns idle/greeting message from config |
| `getHeaderName()` | Returns display name (e.g. "MU/TH/UR 6500") |
| `switchPlugin(name)` | Save conversation, reinitialize with new plugin |
| `resetConversation()` | Clear conversation history and summary for active plugin |
| `_detectRelevantSections(query)` | Regex-based query analysis for selective telemetry |
| `_buildLiveShipContext(query?)` | Build clearance-filtered telemetry block |
| `_maybeCompactConversation()` | Auto-summarize when conversation exceeds MAX_ACTIVE_TURNS |
| `_summarizeConversation(msgs)` | Call gpt-4o-mini to compress older turns into summary |
| `_processGmCommand(cmd)` | Handle incoming GM commands (broadcast, inject, flags, etc.) |
| `sendGmCommand(command)` | Static — emit a GM command to all clients via socket |
| `_getActiveClearance()` | Get current user's clearance level |
| `_canAccessClassification(cls, clearance)` | Check if a classification is accessible |
| `getPromptFlags()` | Return all prompt_update flags and their current state |
| `destroy()` | Save conversation and clean up socket listener |

---

## Customization Points

### Change the AI model or provider

Settings → Module Settings, or in GM CONTROLS:
- **API Base URL**: `https://api.openai.com/v1` (OpenAI) or `http://localhost:11434/v1` (Ollama)
- **API Key**: Required for OpenAI, blank for Ollama
- **AI Model**: `gpt-4o-mini`, `gpt-4o`, `llama3.1:8b`, etc.

### Modify AI personality

Edit `muthur/prompts/prompt_prefix.txt` — this controls the base persona (terse 1980s computer terminal style). Changes affect all scenarios.

### Add scenario-specific lore

Edit `muthur/plugins/{name}/prompts/{name}_prompt.txt` — this is where ship history, crew details, mission briefing, and classified information live.

### Add conditional story beats

Add entries to `prompt_updates` in the plugin's `config.json`:
```json
{
  "my_custom_event": false,
  "prompt_updates": {
    "my_custom_event": "A new event has occurred: describe what happened and how MUTHUR should respond."
  }
}
```
Then toggle at runtime: `game.wyTerminal.sendGmCommand({ type: 'update_flag', flag: 'my_custom_event' });`

### Change telemetry section detection

Edit the regex patterns in `_detectRelevantSections()` (~line 750 of muthur-engine.mjs). Each regex maps keywords to a section name.

### Adjust conversation window size

Modify the static constants:
```javascript
static MAX_ACTIVE_TURNS = 8;        // Increase for longer memory, more tokens
static SUMMARIZE_THRESHOLD = 6;     // How many recent turns to keep after compaction
```

### Force a specific MU/TH/UR response

```javascript
game.wyTerminal.sendGmCommand({
  type: 'inject_response',
  message: 'NAVIGATION SYSTEMS LOCKED.\nAUTHORIZATION REQUIRED.',
});
```
The next player query will return this text without calling the API.
