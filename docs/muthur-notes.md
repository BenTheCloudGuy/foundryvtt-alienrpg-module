# MU/TH/UR Architecture Notes

## Operating Modes

Three modes, selected automatically:

1. Engine mode (default) -- OpenAI API key is set. MuthurEngine sends queries directly to OpenAI with scenario-aware prompts.
2. Iframe mode -- A muthurUrl is configured that isn't an API endpoint. Embeds the external web UI directly.
3. Relay mode -- No API key, no URL. Player queries are forwarded to the GM via socket, GM types a manual response in a dialog.


## How the System Prompt is Assembled

MuthurEngine._buildSystemPrompt() builds the full system prompt by concatenating these pieces in order:

1. Prefix (muthur/prompts/prompt_prefix.txt) -- Universal persona rules. Terse 1980s terminal voice, never break character, real-time telemetry authority rules.
2. Plugin prompt (e.g. muthur/plugins/cronus/prompts/cronus_prompt.txt) -- Scenario-specific briefing. Ship history, crew roster, deck layouts, classified data, what the AI can/can't control, IMG map tags.
3. Prompt updates (config.prompt_updates flags in plugin config.json) -- Conditional story beats appended when their flag is true. Example: "engine_repaired" flag adds "UPDATE: The engine has now been repaired by the crew."
4. Suffix (muthur/prompts/prompt_suffix.txt) -- Just "my players will be interacting with you" (very short).
5. Dynamic prompt (activeConditions array, set by GM add_prompt_context commands) -- Real-time condition injections like [FIRE] at Deck B: fire detected in mess hall.


## How Game State Reaches MU/TH/UR

Two mechanisms:

### A. Live Ship Context (injected every query)

_buildLiveShipContext(userQuery) in muthur-engine.mjs builds a "CURRENT SHIP STATUS -- REAL-TIME TELEMETRY" block that gets injected as a system message before each user query. It reads directly from Foundry settings at query time.

#### Selective Section Injection

To reduce token usage, _detectRelevantSections(query) determines which telemetry sections are relevant to the player's query using keyword matching. Only matched sections are included. If no keywords match, all sections are included as a safe fallback.

| Section | Trigger Keywords |
|---|---|
| systems | status, system, power, engine, reactor, life support, comms, sensor, airlock, cryo, self-destruct, weapon, door, elevator... |
| crew | crew, personnel, roster, who, captain, pilot, medic, engineer, agent, synthetic... |
| logs | log, entry, report, message, record, incident |
| nav | nav, course, heading, speed, destination, eta, location, where, position, fuel, orbit, signal, bearing |
| timers | timer, countdown, how long, when, time remain, detonation, overload |
| cargo | cargo, inventory, supply, equipment, manifest, tritium, payload, hold, armory, weapon, arms |

Special compound triggers: "SHIP STATUS", "WHAT'S THE STORY MOTHER", "SITREP" → systems + nav.

#### Always Included (tiny, essential)

- Ship identity -- shipName, shipClass
- Clearance level -- per-user clearance from userClearanceLevels (GM always MASTER_OVERRIDE)

#### Clearance-Gated Telemetry

The engine has its own clearance helpers (_getActiveClearance, _getClearanceRank, _canAccessClassification) mirroring WYTerminalApp's logic. Data is filtered before it reaches the AI:

| Data | CREWMEMBER (0) | MEDICAL (1) | CAPTAIN (2) | CORPORATE (3+) |
|---|---|---|---|---|
| Systems | Classified systems show `[CLASSIFIED — INSUFFICIENT CLEARANCE]` | Same + MEDICAL systems | Same + PERSONAL | Full access |
| Crew | Names & roles only — no status/location | Full details except COMPANY AGENT | Same | Full details including COMPANY AGENT |
| Logs | Unclassified only; redacted count shown | + MEDICAL logs | + PERSONAL logs | All logs |
| Nav / Timers / Cargo | Full access | Full access | Full access | Full access |

For non-CORPORATE users, the telemetry footer includes an explicit instruction: "Do NOT disclose classified data beyond this level. If asked about restricted information, respond with: ACCESS RESTRICTED — INSUFFICIENT CLEARANCE."

This means classified data is filtered at two layers:
1. **Telemetry layer** -- classified data is never sent to the AI in the first place
2. **Prompt layer** -- plugin prompts (e.g. cronus_prompt.txt) also instruct the AI to check clearance before revealing narrative secrets

The prompt contains strong authoritative instructions telling the model to trust telemetry over background briefing.

### B. Prompt Update Flags (toggled by GM commands)

Each plugin's config.json has boolean flags (e.g. engine_repaired, cronus_cryo_ended, reveal_eev) and a prompt_updates map that adds text to the system prompt when a flag is true. The GM toggles these via socket commands:

- update_flag -- toggles a flag
- set_flag -- sets a flag to a specific value

After a flag change, _rebuildPrompt() is called, which re-runs _buildSystemPrompt() and replaces conversation[0] (the system message).


## Conversation Management

- Per-plugin conversation history stored in static Maps (_pluginConversations, _pluginSummaries).
- Keeps last 8 turn pairs in active context.
- At 8 turns, older turns are auto-summarized via a gpt-4o-mini call and compressed into a "CONVERSATION HISTORY SUMMARY" system message.
- resetConversation() clears history (called after clearance code entry to flush stale access-denied patterns).


## GM Control Mechanisms

All sent via MuthurEngine.sendGmCommand() over Foundry sockets:

- inject_response -- Pre-loads a canned response for the next player query (bypasses OpenAI entirely).
- broadcast -- Shows an alert overlay on all terminals.
- update_flag / set_flag -- Toggles a config flag, rebuilds system prompt.
- add_prompt_context -- Adds a dynamic condition (fire, alert, event) to the prompt.
- clear_condition -- Removes a dynamic condition.
- switch_plugin -- Switches scenario (montero, cronus, fort_nebraska, etc.).
- clear_screen -- Clears chat display.
- play_sound -- Plays a sound from muthur/sounds/.
- update_crew_location, assign_crew_task, update_crew_status, etc. -- Forwarded to ShipStatusManager to change game state.


## Command Code / Clearance in MU/TH/UR

When a player types a 10-digit number in the MU/TH/UR chat, _tryCommandCodeInMuthur() intercepts it:

- Validates against the user's assigned command code.
- If CORPORATE or higher: elevates clearance, resets AI conversation history, returns "RESTRICTED DATA UNLOCKED".
- If the previous query was access-denied, it auto-resubmits after a 1.5s delay.
- The clearance level is included in live telemetry, so MU/TH/UR's prompt sees the updated clearance.


## Where to Control MU/TH/UR Responses

Main levers for shaping what MU/TH/UR says:

1. Plugin prompt files (static narrative context) -- edit the .txt files in muthur/plugins/*/prompts/.
2. Prompt update flags (conditional story beats) -- add new flags + text in plugin config.json prompt_updates, toggle them at runtime.
3. Dynamic conditions (add_prompt_context GM commands) -- inject real-time context without editing files.
4. Injected responses (inject_response GM command) -- bypass AI entirely for scripted moments.
5. Live telemetry -- update Foundry settings (crew roster, systems, logs, nav) and it's automatically included in every query.
6. Prefix/suffix -- edit the shared prompt framework in muthur/prompts/.
7. Conversation reset -- happens automatically on clearance changes; can be triggered to flush bad patterns.


## Plugin Registry

Four plugins defined in PLUGIN_REGISTRY (muthur-engine.mjs):

- montero -- USCSS Montero (MU/TH/UR 6500). The player's starting ship. Carries 200,000 tons of Tritium. Crew of 6. Has Montero-specific prompt updates for signal detection, collision, docking, self-destruct.
- cronus -- USCSS Cronus (MU/TH/UR 2000). The derelict science vessel. Full mission log from 2110. Crew of 30. Detailed deck plans. Classified mission data (CORPORATE clearance). Prompt updates for repairs, life support, airlock states, EEV reveal.
- cronus_life_support -- USCSS Cronus variant for the life support restoration phase. Same ship but different prompt focus. Includes LIFE_SUPPORT_ENABLED / LIFE_SUPPORT_ONLINE key exchange for scripted cryo wake sequence.
- fort_nebraska -- A.P.O.L.L.O. mainframe at Fort Nebraska on Ariarcus. Military base scenario. EMP-damaged systems. Project Life Force classified logs. Extensive personnel roster. Nuclear warhead detonation option.


## Key Files

- scripts/muthur-engine.mjs -- The AI engine. Prompt assembly, OpenAI calls, conversation management, GM command processing, live telemetry building.
- scripts/muthur-bridge.mjs -- Communication layer. Dispatches to engine/iframe/relay mode. Handles socket messaging for GM relay.
- scripts/terminal-app.mjs -- UI integration. _setupMuthurView() wires the chat interface. _sendMuthurMessage() handles user input, command code interception, and display.
- muthur/config.json -- Base config. Model selection, API key, force_upper_case, generic greeting.
- muthur/prompts/prompt_prefix.txt -- Shared persona rules (all plugins).
- muthur/prompts/prompt_suffix.txt -- Shared suffix (all plugins).
- muthur/plugins/*/config.json -- Per-plugin flags, ship systems, crew, locations, travel times, prompt_updates.
- muthur/plugins/*/prompts/*_prompt.txt -- Per-plugin narrative briefing.
- templates/views/muthur.hbs -- Chat UI template with on-screen keyboard.


---

Test queries and expected responses have been moved to [dev/muthur-tests.md](dev/muthur-tests.md).
