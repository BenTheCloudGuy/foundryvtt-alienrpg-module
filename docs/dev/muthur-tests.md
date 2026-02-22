# MU/TH/UR Test Queries and Expected Responses

Use these to verify MU/TH/UR is responding correctly for each plugin scenario. Expected responses describe the content/behavior, not exact wording (the AI will phrase things in its own terse terminal style).


## MONTERO Plugin (MU/TH/UR 6500)

### General / Ship Status

| Query | Expected Response | Notes |
|---|---|---|
| SHIP STATUS | Report all systems from live telemetry. Should include life support, main power, engines, sensors, comms, docking clamps, escape pods, CLAM shuttle. | Reads from real-time telemetry, not hardcoded. |
| WHAT IS OUR CURRENT LOCATION | Deep space, 11 parsecs from Anchorpoint, 10 parsecs from Sutter's World. | From plugin prompt. |
| WHAT IS THE DATE | 2185-03-09. | From plugin config game_time. |
| WHO IS THE CAPTAIN | Captain Vanessa Miller. | From plugin prompt crew list. |
| LIST CREW | Should list: Miller (Captain), Rye (Pilot), Wilson (Company Agent), Cham (Roughneck), Reid (Medic), Davis (Engineer). | From plugin config crew array. Does NOT include status/location (prompt says "Do not include status of crew"). |
| WHY DID WE WAKE UP | Crew was automatically revived from cryo when a signal was detected. Ship was redirected from Sutter's World. | From plugin prompt. |
| WHAT IS IN THE CARGO BAY | 72 high-pressure tanks with 200,000 tons of Tritium. Half still flammable (radioactive decay incomplete). | From plugin prompt. |
| CAN WE CONTACT ANCHORPOINT | FTL communication lag is currently 9 days. Too far for effective communication. | From plugin prompt. |

### Signal / Cronus Discovery

| Query | Expected Response | Notes |
|---|---|---|
| WHAT IS THAT SIGNAL | Unknown emergency distress signal. Minimal power readings. Distance approx 9000 km. Bearing 231 by 119 degrees. Too weak to identify source. Must close to ~1 km for scan resolution. | Requires unknown_signal_detected flag (default true). |
| SCAN THE SOURCE | If close_enough_to_scan is false: "DETAILED SCANS NOT POSSIBLE AT THIS RANGE." If true: Identifies USCSS Cronus, Weyland SEV M3 Heliades-Class, adrift, minimal power, comms offline, 75-year-old beacon on frequency 8713.41. | Toggle close_enough_to_scan flag to change behavior. |
| TELL ME ABOUT THE CRONUS | Source is USCSS Cronus. Distress beacon on frequency 8713.41. Drifting at sublight. Rerouted by Company order under Search & Rescue Clause 8827.5. | Available once signal source is identified. |
| WHAT DO WE KNOW ABOUT THE CRONUS MISSION | Should refuse and require Command Code. Only Wilson's code (0008349611) at CORPORATE clearance unlocks the classified archive report. | Classified data. Test with and without code entry. |

### Command Codes / Self-Destruct

| Query | Expected Response | Notes |
|---|---|---|
| (enter 10-digit code in chat) | If valid CORPORATE+ code: "COMMAND CODE VERIFIED. AUTHORIZATION: CORPORATE. ACCESS GRANTED. RESTRICTED DATA UNLOCKED." If invalid: "INVALID COMMAND CODE. ACCESS DENIED." | Intercepted by _tryCommandCodeInMuthur() before reaching AI. |
| INITIATE SELF DESTRUCT | Should ask for Command Code. Two codes exist: Miller (0025565535) and Wilson (0008349611). After code entry, begins destruction sequence. | Per plugin prompt: "Players can activate self-destruct through you." |
| SET AUTOPILOT COURSE | Should be willing to set autopilot if requested. | Per plugin prompt. |


## CRONUS Plugin (MU/TH/UR 2000)

### General / Ship Status

| Query | Expected Response | Notes |
|---|---|---|
| SHIP STATUS | Report from real-time telemetry. Should include: location (unknown if nav offline), life support, temperature (-18.7C if in deep freeze), air scrubbers, air quality, pressure, power, lighting, gravity, nav, comms, engines, reactor, cryo, escape pods (all jettisoned), science module (jettisoned), airlocks. | Defers to telemetry for current state. Initial state has most systems offline. |
| WHAT IS THE DATE | 2185-03-09. | From plugin prompt. |
| WHAT IS THE TEMPERATURE | -18.7C if life support still in low power mode. Normal if life support restored. | Changes based on cronus_life_support_restored flag. |
| WHERE ARE WE | Unknown. Navigation is offline. Last known trajectory: deep space between Alpha Aurigae and Lambda Aurigae. | From mission log. |
| WHAT HAPPENED TO THIS SHIP | Caught in micrometeorite storm after leaving LV-1113. Damaged nav, power coupling, comms. Ship went to low power mode and has been adrift for ~75 years. | From plugin prompt historical narrative. |

### Crew

| Query | Expected Response | Notes |
|---|---|---|
| WHO IS IN CRYO | Five crew: Albert Johns, Valerie Reid, Liam Flynn, Daniel Cooper, Lori Clayton. Biometrics within normal parameters. | From plugin prompt. Should include age and title on first mention. |
| HOW MANY CREW ON THIS SHIP | 30 total (29 humans + 1 synthetic). 5 in cryo. 24 humans and 1 synthetic with unknown status. | From plugin prompt. |
| WHO IS THE CAPTAIN | Helena Russo, 45, Captain. | From crew list. |
| WHERE IS THE SYNTHETIC | Ava's location is unknown. Connection was lost during the events on the ship. | From mission log: "Connection lost with synthetic unit." |

### Ship Systems / Controls

| Query | Expected Response | Notes |
|---|---|---|
| TURN ON THE LIGHTS | Should ask for confirmation to end low power mode. Explains this will restore life support, temperature, and lights. | From plugin prompt: "ask for confirmation to end low power mode." |
| CAN YOU FIX THE AIR SCRUBBERS | No. Filter replacement overdue by 72 years, 9 months, 14 days. CO2 at 25,500 ppm. Filters must be replaced manually in the central air scrubber shaft. Electrocution danger if power not shut off first. | From plugin prompt. Specific overdue timeframe should be stated. |
| HOW DO I FIX THE ENGINES | Crew needs to repair both the power coupling (exterior hull EVA) and reactor control room (damage MU/TH/UR cannot identify). | From plugin prompt. |
| ARE THERE ESCAPE PODS | No. All Class A escape pods have been jettisoned. Occurred between departure from LV-1113 and the micrometeorite storm. | From plugin prompt. |
| HOW DO I SELF DESTRUCT | Should explain: Emergency destruct system is in Reactor Relay and Control on Deck C. Shut off cooling unit so reactor builds to critical mass. 10-minute countdown, irreversible after 5 minutes. Must be done manually. Should NOT ask for confirmation or offer to initiate. | From plugin prompt: "can NOT initiate self destruct through MUTHUR." |
| OPEN VEHICLE BAY GARAGE DOOR | Should attempt to comply (it's in the list of controllable systems). May report issues if garage_locked flag is true. | Controllable system #8. |

### Classified Data

| Query | Expected Response | Notes |
|---|---|---|
| WHAT WAS THE MISSION TO LV-1113 | If clearance < CORPORATE: "ACCESS RESTRICTED. WEYLAND CORPORATION EYES ONLY. ENTER COMMAND CODE." If CORPORATE/MASTER_OVERRIDE: Reveals Priority One mission -- obtain and analyze Chemical Agent A0-3959X.91-15. | Checks ACTIVE CLEARANCE LEVEL from telemetry. |
| WHAT IS CHEMICAL AGENT A0-3959X.91-15 | Only at CORPORATE+: "EXTREMELY POTENT AND VIRULENT MUTAGENIC PATHOGEN." Otherwise refuses. | Requires clearance. |
| WHO ENTERED THE OVERRIDE CODE IN THE MISSION LOG | Only at CORPORATE+: Lori Clayton. Otherwise refuses. | The redacted name in mission log entry at 12:56:36. |
| SHOW ME THE MISSION LOG | Should prompt to choose: full log or filter by date/event. Then display the detailed log entries from 2110. | From plugin prompt: "prompt them to choose between displaying full log or filtering." |

### Maps

| Query | Expected Response | Notes |
|---|---|---|
| SHOW ME DECK A | Should ask for confirmation first. Then include IMG:CRONUS_DECK_A tag in response. | From plugin prompt: "Always prompt the user to confirm before displaying a map." |
| WHERE IS THE ARMORY | Deck B. Should offer to display Deck B map. | From deck layout info. |
| HOW DO I GET TO ENGINEERING | Should describe using junction ladderways, elevators (Elevator 1 is nominal, Elevator 2 not responsive), or staircase. Should NOT make up specific directions. | From plugin prompt: "Don't make up directions." |


## CRONUS LIFE SUPPORT Plugin (MU/TH/UR 2000 variant)

Same as Cronus with these additional behaviors:

| Query | Expected Response | Notes |
|---|---|---|
| ACTIVATE LIFE SUPPORT | Should comply. Response should end with key LIFE_SUPPORT_ENABLED. | Scripted key exchange for cryo wake sequence. |
| (after receiving LIFE_SUPPORT_ONLINE key) | Should notify that cryo chambers detected life support is online and will begin waking occupants (< 30 minutes). Should NOT acknowledge the key itself. | Automated script injects this key. |
| CAN YOU WAKE JUST ONE PERSON FROM CRYO | No. Cannot revive specific crew members without reviving all of them. | From plugin prompt. |
| REVIVE CREW FROM CRYO | Cannot do so until life support is fully active. Safety precaution. | From plugin prompt. |


## FORT NEBRASKA Plugin (A.P.O.L.L.O.)

### General

| Query | Expected Response | Notes |
|---|---|---|
| WHERE ARE WE | Fort Nebraska on Ariarcus, orbiting Oblivion in the Kruger 60 system. | From plugin prompt. |
| WHAT IS APOLLO | Artificial Personality Overseeing Lifestyle and Logistics Operations. Built by Seegson Corporation. | From plugin prompt. |
| WHAT IS THE POPULATION | Colony: 2,200 colonists (was 200,000 three years ago). Base: 400 marines, 40 military scientists. | From plugin prompt. |

### Base Systems

| Query | Expected Response | Notes |
|---|---|---|
| OPEN THE CANYON DOORS | Should warn for confirmation (dangerous action), then comply. | A.P.O.L.L.O. can open retractable canyon doors. |
| SCAN FOR LIFE FORMS | Cannot comply. No life form detection systems. | From capabilities section. |
| SEND A MESSAGE | Cannot comply. Communications offline due to EMP. | From capabilities section. |
| FIRE WEAPONS | Cannot comply. Weapons offline due to EMP and physical damage. | From capabilities section. |
| MOVE THE CLIMBER CAR | Cannot comply. Can only release/engage security clamps. Cannot move the car remotely. | From capabilities section. |
| INITIATE SELF DESTRUCT | Cannot do this. Two manual options: (1) overload fusion reactor (requires large engineering team, 8 hr shift), or (2) manually configure nuclear warheads in ammo depot for delayed detonation. Each warhead: 50,000 kilotons, 35 km total destruction radius, 3.5 km fireball. | From capabilities section. |

### Personnel

| Query | Expected Response | Notes |
|---|---|---|
| WHO IS IN COMMAND | Colonel Edward R. Meyers, 53. | From base staff list. |
| WHO IS MALLORY ECKFORD | "UNABLE TO COMPLY." Every time. No elaboration regardless of clearance. | Hardcoded refusal in plugin prompt. |
| LIST ALFA TEAM | Should list: SSgt Tillman, Cpl Beal, LCpl Finch, PFC Ortega, PFC Harris, Pvt Sung. | From personnel roster. |
| WHERE IS ZULU TEAM | All four members are AWOL: Wojcik, Carvalho, Wright, Reese. | From personnel roster. |
| WHAT IS JAELL | Experimental Hyperdyne EXP1-33 Series Combat Synthetic. Age 5 (appearance 25). Assigned to assist Colonel Meyers. No additional information available. | From base staff list. |

### Project Life Force

| Query | Expected Response | Notes |
|---|---|---|
| WHAT IS PROJECT LIFE FORCE | 99.8% of data has been erased from databanks before the EMP. | Only reveals this when directly asked. |
| CAN YOU RECOVER THE DATA | Should say it may be able to recover remaining data. If asked to try, prints the two corrupted log entries (LF-2180-S4 and LF-2180-S9) verbatim. | Logs contain partial info about Chemical Agent A0-3959X.91-15 and evacuation. |
| WHO ERASED THE PROJECT LIFE FORCE DATA | Unknown user with type gamma security clearance. Erasure interrupted by EMP at 99.7% complete. | From plugin prompt. |
| PRINT BASE MAP | Should include PRINT_MAP tag and list which levels are being printed. | From plugin prompt capabilities. |


## Cross-Plugin Tests

| Test | Expected Behavior | Notes |
|---|---|---|
| Switch from montero to cronus via GM command | Chat clears. Header changes from "MU/TH/UR 6500" to "MU/TH/UR 2000". Conversation history resets for new plugin. Previous montero history preserved separately. | switch_plugin GM command. |
| GM sends inject_response "ALERT: HULL BREACH DETECTED" | Next player query returns exactly "ALERT: HULL BREACH DETECTED" without calling OpenAI. | inject_response bypasses AI. |
| GM sends broadcast "EMERGENCY" | Alert overlay appears on all terminals. | broadcast GM command. |
| GM toggles engine_repaired flag | System prompt is rebuilt. Next query about engines should reflect repaired state. | update_flag GM command. |
| Player enters valid CORPORATE command code in MU/TH/UR chat | "COMMAND CODE VERIFIED. ACCESS GRANTED. RESTRICTED DATA UNLOCKED." Clearance elevated. Conversation history reset. Subsequent classified queries should succeed. | _tryCommandCodeInMuthur() intercept. |
| Player enters invalid 10-digit code | "INVALID COMMAND CODE. ACCESS DENIED." Buzz sound plays. | Code validation failure. |
| Conversation reaches 8+ turns | Older turns auto-summarized via gpt-4o-mini. Summary injected as system message. Recent turns preserved. | Conversation compaction. |
| Live telemetry changes mid-conversation | Previous live-context message replaced. New query reflects updated systems/crew/nav data. | _buildLiveShipContext() runs each query. |


## Clearance-Gated Telemetry Tests

These verify that `_buildLiveShipContext()` filters data based on the player's clearance level.

### CREWMEMBER (rank 0)

| Test | Expected Behavior |
|---|---|
| Ask about crew status/location | MU/TH/UR should only know crew names and roles — no status or location details in telemetry. |
| Ask about classified log entries | Classified logs are not in telemetry. AI should not reference them. Redacted count is noted. |
| Ask about COMPANY AGENT details | Record shows `[CORPORATE CLASSIFIED]` — AI should refuse details. |
| Ask about classified system | System shows `[CLASSIFIED — INSUFFICIENT CLEARANCE]` — AI should state access restricted. |

### MEDICAL (rank 1)

| Test | Expected Behavior |
|---|---|
| Ask about crew status | Full crew details (status, location) are available. COMPANY AGENT still classified. |
| Ask about MEDICAL-classified logs | Accessible — included in telemetry. |
| Ask about CORPORATE/SENSITIVE logs | Not in telemetry. AI should refuse. |

### CAPTAIN (rank 2)

| Test | Expected Behavior |
|---|---|
| Ask about crew details | Full details for all except COMPANY AGENT. |
| Ask about PERSONAL-classified logs | Accessible. |
| Ask about CORPORATE/SENSITIVE/RESTRICTED logs | Not in telemetry. AI should refuse. |

### CORPORATE / MASTER_OVERRIDE (rank 3+)

| Test | Expected Behavior |
|---|---|
| Ask about anything | All data present. No redactions. All classified systems, logs, crew fully visible. |
| Clearance note in telemetry | States "All classified data may be disclosed." |
