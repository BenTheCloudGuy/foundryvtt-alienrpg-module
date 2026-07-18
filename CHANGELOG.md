# Changelog

## v1.2.19 — 2026-07-18

### NAVIGATION — engine-governed throttle, restored + live

- The **ENGINE throttle** (`[ FULL STOP ] [ − 0.1 ] [ + 0.1 ] [ FULL SPEED ]`) is back — it now shows whenever the NAV chart is present, not only when a ship is detected/underway.
- **ENGINE status now governs propulsion.** Max speed = the ship's FTL rating × the ENGINES power factor: `OFFLINE` → **0 (no movement)**, `CRITICAL` ≈ 30%, `WARNING` ≈ 60%, `ONLINE/NOMINAL` → full. `FULL SPEED` and the `+0.1` step clamp to this live max.
- **Engine changes hit NAV movement in real time.** While a course is underway, the ship's travel is re-evaluated every ~1.5 s against ENGINE status: knocking engines offline **halts** the ship on the spot, restoring them **auto-resumes** at the commanded speed, and degraded engines **throttle it down** — all without teleporting (it rebases from the current position). The SPEED/ETA readouts reflect this immediately.

## v1.2.18 — 2026-07-18

### NAVIGATION — even system distribution

- Replaced the fit-to-map placement (which faithfully reproduced the source data's two tight clusters either side of Sol) with an **even, rank-based distribution**: each system is ranked along Coreward and Spinward independently and dropped into an evenly-spaced slot. Systems now fill the whole chart with no clustering while keeping left→right / bottom→top ordering. Validated against the full set: **88% width / 88% height coverage, 106 px minimum spacing, nothing off-scene**.

## v1.2.17 — 2026-07-18

### NAVIGATION — systems auto-plot and spread across the map

- SYSTEM tokens now **auto-plot onto the NAV scene on load** (GM), so you no longer need to open GM settings and run PLOT KNOWN SYSTEMS by hand (the button still works).
- Placement switched to a **"fit to map"** model: every system's coordinates are mapped onto the scene by their bounding box (independent X/Y scale, capped at 2× to limit distortion, centred). This spreads systems across the chart and keeps their relative layout recognisable, and it's immune to the light-year/parsec calibration question. Validated against the full system set: all systems land on-scene, covering ~84% width / ~71% height with no clustering into a corner.

## v1.2.16 — 2026-07-18

### NAVIGATION — calibrated to the Middle Heavens art

- Calibrated **PLOT KNOWN SYSTEMS** to the actual "Stars of the Middle Heavens" map. Using the canonical core-rules scene (native 4804×3106, Sol at centre, printed grid ≈ 100 px per parsec), placement now scales as a fraction of the NAV scene (so it holds even though the map is stretched to fit), and treats each system's `location` value as **light-years**, converting to parsecs (÷3.26) for the grid. Calibration lives in three tunable constants so a single known system can lock it exactly.

## v1.2.15 — 2026-07-18

### NAVIGATION — fit the whole chart

- **PLOT KNOWN SYSTEMS** now auto-expands the NAV scene's padding so the farthest system (plus a margin) fits on the canvas. The Middle Heavens map image stays centred at its native scale for the core systems; distant systems (e.g. the Far Spinward Colonies) plot in the space beyond the map edge at their correct grid offset instead of falling off.
- The terminal **NAV zoom-out now reaches 200 beyond the farthest plotted system** (recomputed as systems load), so you can always pull back to see every contact with margin, and zoom-to-cursor/pan limits follow suit.

## v1.2.14 — 2026-07-18

### NAVIGATION — PLOT KNOWN SYSTEMS matches the Middle Heavens map

- Calibrated **PLOT KNOWN SYSTEMS** to the "Stars of the Middle Heavens" starmap the NAV scene uses. The map's axes are **COREWARD = right (+X)** and **SPINWARD = up (+Y)** with Sol at the scene centre — the module had these **swapped** (spinward→X, coreward→Y), which transposed every system except SOL (0,0). Systems now land in the correct place.
- Placement now scales by the scene **grid size (1 square = 1 parsec)**, matching the map's own grid and the parsec units in each system's `location`, instead of the synthetic ±50 chart scale.
- The ship auto-travel ticker was aligned to the same mapping so a plotted destination and the ship that flies to it share the exact pixel.

## v1.2.13 — 2026-07-18

### NAVIGATION — PLOT KNOWN SYSTEMS accounts for every system

- **PLOT KNOWN SYSTEMS** now plots **every** SYSTEM actor. When an actor is missing its `spinward/coreward` flags it resolves the position from the STAR SYSTEMS DB (by `starDbId`, then by name) — the same Middle Heavens `location` the original starmap used — so systems land where they belong instead of being silently skipped.
- Every plotted token is now forced to **SYSTEM** (never STATION), and re-running **repairs** any existing tokens that were left marked STATION.
- Systems with no/CLASSIFIED coordinates can't be placed on the chart; they're now reported by name in the notification instead of vanishing quietly.

## v1.2.12 — 2026-07-18

### NAVIGATION — GM can designate the player ship

- The GM can now explicitly mark which NAV contact is the player ship: select a token and click **☆ SET AS PLAYER SHIP** in the readout (click again to clear). The designation is persisted (`navData.playerShipTokenId`) and takes precedence over name/type auto-detection, so course plotting and tracking always use the correct object. Clearing reverts to auto-detect.

## v1.2.11 — 2026-07-18

### NAVIGATION — engine throttle always available

- The **ENGINE** throttle (`[ FULL STOP ]  [ − 0.1 ]  [ + 0.1 ]  [ FULL SPEED ]`) now shows on the NAV page whenever the player ship is on the chart — not just while a course is active. Steps are a fixed **±0.1 AU/day**; `FULL SPEED` = the ship's max (FTL RATING ÷ 10).
- With no active course the throttle sets a **commanded cruise speed** (persisted), which drives the NAV **SPEED** readout and pre-fills the **SET COURSE** speed to match the ship's max. With a course active the throttle adjusts the live travel speed as before. Player throttle input routes to the GM.

## v1.2.10 — 2026-07-18

### NAVIGATION — FTL speed from the ship's FTL RATING

- The NAV travel speed (ETA, SET COURSE default, throttle `FULL SPEED` / steps) is now derived from the active ship actor's **FTL RATING** attribute — **rating ÷ 10 = AU/day** (e.g. the Montero's rating of 12 → **1.2 AU/day**). Falls back to the ship profile value, then 0.1, if no ship actor is found. Run **BUILD MONTERO & CRONUS SHIP ACTORS** so the ship actors exist.

## v1.2.9 — 2026-07-18

### SHIPS — Montero & Cronus spacecraft actors

- Added **GM CONTROLS ▸ BUILD MONTERO & CRONUS SHIP ACTORS** (and `game.wyTerminal.buildShipActors()`) — creates/updates the **USCSS Montero** and **USCSS Cronus** `spacecraft` actors in a **01. SHIPS** folder, populated with canonical data:
  - **Montero** — Lockmart CM-88B Bison M-Class Starfreighter (unarmed): hull/armor/FTL/length/lease stats, `MONTERO.png` art, and embedded **module** items (cargo hold, cryonics bay, life support, escape pods).
  - **Cronus** — C-Class Military Science Vessel: heavier stats, `CRONUS.png` art, embedded **weapon** items (rail gun, missile battery, point-defense array) and **module** items (science pod, cryo vault, biohazard cargo bay, med-lab).
  - **Crew** are linked into each ship's occupant list, matched to your existing world crew actors by name (Miller/Davis/Cham/Wilson/Rye; Johns/Cooper/Flynn/Clayton/Reid/Ava-6) with their roles as positions. Unmatched crew are reported in the notification.
- Idempotent by `flags.wy-terminal.shipId` — re-running updates the existing actors (refreshing stats, art, items, and crew) rather than duplicating.

## v1.2.8 — 2026-07-18

### NAVIGATION — throttle controls + detailed ETA

- Added **THROTTLE** controls to the NAV status panel (shown while a course is active): **[ − ]** / **[ + ]** step the speed in quarter increments of the ship's rated FTL speed, **[ FULL STOP ]** holds position (speed 0), and **[ FULL SPEED ]** sets the rated maximum. Speed changes rebase the course from the ship's current position/fuel so it never teleports. Players' throttle input is routed to the GM over the socket.
- **ETA now reads out as MONTHS / DAYS / HOURS / MINUTES** (e.g. `2MO 05D 12H 30M`) everywhere it appears — the status panel, the live ticker, and the SET COURSE preview. A stopped ship shows `HOLDING`; SPEED shows `FULL STOP` at zero.

## v1.2.7 — 2026-07-18

### NAVIGATION — active course tracking

- **SET COURSE**: selecting any non-ship contact (system, station, ship) in the NAV readout now shows a **SPEED (AU/DAY)** input, a live **EST. ETA** preview (distance ÷ speed, updates as you change speed), and a **◈ SET COURSE** button. Changing speed updates the ETA before committing.
- Once a course is set, the whole NAV status readout becomes **live and real-time**, derived from the game clock: **POSITION**, **DESTINATION**, **DST COORDINATES**, **HEADING**, **SPEED**, **ETA** and **FUEL** reserves all update every second. Fuel counts down as it is consumed (0.5%/AU), and ETA shows `ARRIVED` or `OUT OF FUEL` at the ends.
- The **ship token physically auto-travels** along the plotted course on the NAV scene as game time passes (GM-driven), interpolating position from elapsed game-time × speed. On arrival it snaps to the destination, stops, and logs **ARRIVED** exactly once (no more arrival log spam); running dry logs a single fuel-depletion warning.
- **Players can plot a course too** — a player's SET COURSE request is routed to the GM over the module socket, and the GM writes the course + drives the ship. An in-progress course resumes automatically after a reload.

## v1.2.6 — 2026-07-18

### SYSTEMS — actors from a single source of truth

- The **STAR SYSTEMS database is the single source of truth** for systems. Workflow: **IMPORT PLANET-SYSTEM ITEMS → STAR DB** (seeds the DB with the rich AlienRPG world data), maintain/edit systems + **STATUS** in the STELLAR CARTOGRAPHY view, then **BUILD SYSTEM ACTORS (FROM STAR DB)** to (re)generate `planet` System actors in the **05. SYSTEMS** folder.
  - **IMPORT PLANET-SYSTEM ITEMS → STAR DB** — converts installed `planet-system` items into STAR SYSTEMS entries (name, sector, coordinates from `location`, affiliation, and a dossier); idempotent by a `wyt-item-<id>` id. `game.wyTerminal.importItemsToStarDB()`.
  - **BUILD SYSTEM ACTORS (FROM STAR DB)** — creates/updates `planet` actors from every STAR SYSTEMS entry, carrying STATUS + sector/territory/affiliation/classification + coordinates into `flags.wy-terminal` and the dossier into notes; idempotent by `starDbId`. `game.wyTerminal.buildSystemActors()`.
- The Middle Heavens coordinate parser now accepts comma- or slash-separated pairs (e.g. `-6.8 Rimward, 0.2 Spinward`).
- **GENERATE PLANET IMAGES**: renders a procedural monochrome-green planet (seeded by system name) for each SYSTEM actor and assigns it as the actor + prototype-token art. `game.wyTerminal.generatePlanetImages()`.
- **System STATUS tracking**: systems carry a status (ACTIVE / SURVEYED / UNEXPLORED / RESTRICTED / QUARANTINED / ABANDONED / DECOM / CLASSIFIED). NAV shows the selected contact's STATUS colour-coded, and the GM can set it from a dropdown in the NAV readout (persisted on the linked System actor). Added **RESTRICTED** to the STAR SYSTEMS editor.

### NAVIGATION — systems on the chart

- The NAV token scene now spans **±50 AU** (3200²/32px grid) so real system coordinates fit. Re-run **CONFIGURE NAV SCENE** to apply.
- **PLOT KNOWN SYSTEMS** now prefers the built **SYSTEM actors** — placing tokens linked to each `planet` actor at its coordinates so the NAV readout shows the actor's dossier + SECTOR — and falls back to the bundled cartography JSON only if no System actors exist.

## v1.2.5 — 2026-07-18

### NAVIGATION — deep-space level-of-detail chart

- The NAV chart is now a **level-of-detail renderer** that stays crisp at every zoom. The core worlds **scene** remains ±25 AU (where tokens are placed), but the chart **zooms/scrolls out to ±400 AU** of open space, opening zoomed into the core on the active ship. Max zoom-out is fitted to the larger canvas dimension so the field edge never overscans.
- The grid **redraws as you zoom** — fine 5-AU cells near the core, coarsening to 25/50/100/250 AU as you pull back — with **zero-padded corner coordinates** like `(-005 +012)` at each major intersection. SOL stays fixed at 0,0.
- Blips are plotted by AU coordinate (not scene pixels) and shrink/grow with zoom; pan (drag/one-finger), wheel/pinch zoom-to-cursor, and the +/−/reset buttons all drive the AU view. Replaces the previous CSS-transform zoom on NAV.

## v1.2.4 — 2026-07-18

### NAVIGATION — interactive green star chart

- Replaced the static NAV image with a **rendered green-phosphor star chart**: black background with a seeded starfield, a coordinate grid, coordinate numbers, Spinward/Coreward axes, and **SOL permanently at 0,0** (chart centre). Uses the Alien RPG "Middle Heavens" model — 1 grid = 1 AU, span ±25 AU.
- **Coordinates** are shown for any selected contact (e.g. `6.8 RIMWARD / 0.2 SPINWARD`), computed from its position relative to Sol.
- **Live distance + time-to-arrival**: selecting a contact shows its distance (AU) and ETA from the active player ship, recalculated live as the ship moves. ETA uses a per-ship FTL rate (`ftlSpeedLyPerDay` on the ship profile) and auto-formats days → months → years.
- **SYSTEM** contacts read their dossier (sector, territory, affiliation, description) from the stellar-cartography database.
- New GM CONTROLS: **CONFIGURE NAV SCENE** (applies a 2400² / 48px AU grid + bakes the chart into the scene background) and **PLOT KNOWN SYSTEMS** (auto-places unlinked SYSTEM tokens from `starsystems.json` at their real coordinates, idempotent). Also `game.wyTerminal.setupNavScene()` / `plotNavSystems()`.

### Player Terminal

- Suppressed Foundry's core "no Token in this Scene which gives you visibility of the area" vision warning on player terminal clients (the canvas is hidden there, so the notice was just noise).

## v1.2.3 — 2026-07-18

### SCHEMATICS

- The **SHIP SCHEMATICS** view now shows the selected ship map **only** — crew/player token overlays and the "detected signatures" roster were removed. Live crew tracking remains on SENSORS ▸ INTERNAL.

### NAVIGATION

- NAV chart contacts are now **sized to their actual token size** on the NAVIGATION scene (token footprint as a % of the scene) instead of a fixed oversized glyph. Blips track the map scale and the zoom level.
- Fixed NAV blips **not lining up** with the Foundry scene: the contact icon is now centred on the token position with its label positioned out-of-flow below it (previously the icon + label were centred as a group, pushing the icon above the true point).
- NAV contact **names are now hidden until a contact is selected** — keeping the chart uncluttered — with the exception of **SHIP** tokens (the players' location), whose names always show.
- NAV now **opens locked onto the active player ship** — the chart auto-centres and zooms in on the ship configured on the GM screen (`activeShip`, e.g. MONTERO / CRONUS), matched to a SHIP token on the NAVIGATION scene by name.

## v1.2.2 — 2026-07-18

### Fixes

- Changing the active scene no longer forces player terminals to jump to the **SHIP SCHEMATICS** view. The GM's scene change now updates the tracked scene quietly in the background; the SCHEMATICS view only re-renders (and plays the screen-change tone) for players who are already viewing it.
- Fixed the SENSORS / SCHEMATICS token tracker being **off by a little bit**: token positions now use the token's *centre* (top-left + half its footprint) instead of its top-left corner, so CSS-centred blips/tokens line up exactly with the token on the Foundry scene. Drag-to-move commits the reverse conversion accordingly.
- Fixed a **zoom/pan lock regression**: a disabled pinch-zoom handler still processed two-finger gestures, so pinching on the nested NAV/SCHEMATICS map also transformed (and unlocked) the whole terminal display. The touch-move handler now respects the `enabled` flag, so only the intended map area moves and every other page stays locked.

### SENSORS — Range & Radar

- **Sensor RANGE is now a meaningful distance scale.** The EXTERNAL radar rings are labelled in **AU** (outer ring = maximum sensor range = the SENSORS system's full range), and the degraded effective-range ring is labelled with the current range in AU.
- **Range-based contact visibility:** spacecraft beyond the effective sensor range are now **invisible** (previously they were pinned to the outer ring). Contacts within the outer ~15% *edge band* of the effective range show **intermittently** — each radar sweep has only a chance to refresh them, and they render dimmer, like weak returns fading in and out at the limit of detection. True range readouts are computed from the token's actual distance (no longer clamped).

### SENSORS — Internal Hazards (pre-place & trigger)

- Internal-sensor hazards (FIRE / RADIATION / DAMAGE / NO O2) and doors can now be **pre-placed hidden** via a **PRE-PLACE (HIDDEN)** toggle in the GM tools. Hidden markers are invisible to players and shown to the GM as a pulsing dashed "armed" ghost.
- The GM marker list gained a **TRIGGER / HIDE** button to reveal or re-hide each marker. Triggering a hazard reveals it to all player terminals and pushes an alert (e.g. `⚠ RADIATION DETECTED — 6 RADS`).
- Added a scripting hook for event-driven reveals: `game.wyTerminal.triggerHazard(deckId, idOrLabel, reveal)` (label/type or id match; omit `reveal` to toggle) — call it from a macro tied to any in-game event.

### DOORS — FoundryVTT integration

- New **DOOR CONTROL** panel in GM CONTROLS: **LOCK ALL DOORS** / **UNLOCK ALL DOORS** seals or unseals every wall door (and secret door) across all deck scenes for the active ship in one click, and mirrors the LOCKED/UNLOCKED state onto the internal-sensor DOOR markers.
- **SHIP LOCKDOWN** (Emergency) now automatically seals all doors when activated and unseals them when lifted.
- Exposed `game.wyTerminal.lockAllDoors()` / `unlockAllDoors()` for macros/automation.

### NAVIGATION — scene-driven chart

- The NAV view's manual GM marker system is replaced with a **scene-driven star chart**. Create a Foundry scene named **NAV** (or NAVIGATION), set its background to your star map, and drop tokens onto it — they render as selectable **STATION / SYSTEM / SHIP** blips on the terminal NAV chart, tracked live (GM token moves update player terminals in real time).
- Tokens are typed by linked actor: **spacecraft → SHIP**; the GM selects a contact and picks **SHIP / STATION / SYSTEM** from the NAV TYPE selector (stored as a `flags.wy-terminal.navType` token flag).
- Tapping a blip opens an **info panel** to the right of the chart, populated directly from the token's linked Foundry actor (designation, model/class, manufacturer, crew, length, hull, armor, and notes).
- When no NAV scene exists, the GM sees a setup hint and players see an "awaiting telemetry" message. The HEADING / SPEED / FUEL / ETA status table and live ETA countdown are retained.
- Pinch/scroll-zoom and drag-pan are now **contained to the NAV chart** — only the star-chart image and its tokens transform; the rest of the terminal page stays static. Zoom buttons also drive the NAV chart.

## v1.2.1 — 2026-07-17

### External Radar Target Data

- The EXTERNAL radar readout now reads full spacecraft data from the tracked token's actor: DESIGNATION, MODEL/CLASS, MANUFACTURER, ARMAMENTS, MODULES/UPGRADES, AI, CREW, LENGTH, HULL, ARMOR, DAMAGE, plus BEARING/RANGE/SIZE. Empty fields are hidden.
- Fixed the NOTES section showing `[object Object]`: notes are now read via a robust extractor that handles both string and object (`{value}`/`{content}`) fields and falls back to the actor's general notes.

### Content Import

- Added a GM helper to bulk-import AlienRPG compendium content into the world: `game.wyTerminal.importAlienContent()` (all AlienRPG packs) and `game.wyTerminal.importSpacecraft()` (spacecraft actors only), plus **IMPORT SPACECRAFT ONLY** / **IMPORT ALL ALIENRPG CONTENT** buttons in GM CONTROLS. Includes a confirmation prompt and organizes imports into folders.

## v1.2.0 — 2026-07-17

### SENSORS View (new)

- Added a **SENSORS** button/view (left NAV column) with **INTERNAL** and **EXTERNAL** tabs; removed the orphaned MAPS view/template.
- **INTERNAL bio-scan** renders the ship deck image with live life-sign blips read from the deck's Foundry scene tokens (GM-hidden tokens excluded).
  - Independent deck selection (does not depend on SCHEMATICS): decks are the scenes matching the active ship profile — single deck auto-displays, multiple decks show a DECK selector defaulting to a MAIN deck.
  - Small **name labels** above crew blips; GM can override any crew label from GM CONTROLS ▸ INTERNAL SENSOR CREW LABELS. **Hostile/secret** disposition tokens always read **UNKNOWN**.
  - Old-school SONAR behavior: a horizontal scan line sweeps top→bottom and each blip only jumps to its latest position **as the scan line passes over it**. Steady dots (no pulsing/resize/color animation).
  - GM overlay markers placed on the deck: **DOOR** (red padlock = LOCKED, green padlock = UNLOCKED, with a TOGGLE), and hazard boxes **FIRE** (yellow), **RADIATION** (yellow + `N RADS`), **DAMAGE** (large red area box), **NO O2** (cyan box with crossed O₂). Boxes are drag-to-move and drag-to-resize; markers persist per deck and sync to players.
- **EXTERNAL radar** is an animated scope (range rings, crosshair, rotating sweep with fading trail) that tracks **SPACECRAFT** tokens dropped on a Foundry scene named **RADAR**.
  - `game.wyTerminal.setupRadarScene()` (and GM CONTROLS ▸ EXTERNAL RADAR button) applies a generated radar-scope background (`images/radar-scope.png`) and squares/gridless-sizes the RADAR scene so tokens line up with the rings.
  - Scene centre = ship, outer ring = max range, bearing 0° = top (clockwise). Blip size scales with token size; **target data** is read from the spacecraft actor's notes field and shown in a right-hand readout panel when a blip is tapped.
  - Positions update in real time but each blip only repaints **when the sweep passes its bearing** (radar persistence). Retired the old GM-settings contact list.

### Sensor System Status Integration

- SENSORS view reacts to the **SENSORS** ship system: **OFFLINE** blanks both tabs with a "SENSOR ARRAY OFFLINE" panel; **diminished** (WARNING/CRITICAL or reduced `RANGE: XX AU`) shrinks the effective range (out-of-range external contacts dropped, dashed range ring shown) and adds accuracy jitter/noise on both tabs. A status bar shows the current sensor state.

### NAV

- Fixed the NAV star map not extending to the base of the page (fill-height layout + `object-fit: cover`).

### Fixes

- Fixed the RADAR scene background not applying (now uses flattened `background.src` update keys and redraws the active scene).
- Hardened the external radar layout to stop the GM view scrolling out of bounds.

## v1.1.0 — 2026-02-20

### Per-User Clearance System

- Replaced global shared clearance with independent per-user clearance levels. Each logged-in user now has their own clearance state that can be elevated or revoked independently.
- Each player user is assigned a unique 8-digit command code tied to a clearance role (MEDICAL, CAPTAIN, CORPORATE, MASTER_OVERRIDE).
- CMD CODE view redesigned for GM: displays a per-user management table showing every player's name, current clearance dropdown, code role dropdown, and 8-digit code input.
- Added SAVE ALL, REGENERATE ALL CODES, and REVOKE ALL CLEARANCE bulk-action buttons to the GM CMD CODE view.
- Player CMD CODE view unchanged — numeric keypad for code entry plus a LOGOUT button to voluntarily revoke own clearance.
- MU/TH/UR chat now validates command codes against the entering user's own assigned code and role.
- Socket payloads include `userId` so clearance changes target the correct user without affecting others.
- Added `userClearanceLevels` and `userCommandCodes` world settings (Object type) to store per-user state.

### Clearance Overlay Banners

- Replaced native `ui.notifications.warn` access-denied messages with a custom full-width clearance overlay banner.
- Overlay displays "CLEARANCE LEVEL [X] REQUIRED" in amber with CRT-styled animation, auto-dismissing after a few seconds.
- Applied consistently across crew, logs, and emergency views when a player lacks sufficient clearance.

### CORPORATE Log Visibility Fix

- Fixed hard-coded filter that unconditionally stripped CORPORATE-classified log entries from non-GM players regardless of their clearance level.
- Log visibility now uses `_canAccessClassification()` which properly checks the requesting user's per-user clearance against the log's classification.

### Crew Folder Filter

- Added a crew folder filter section to GM CONTROLS allowing the GM to select which Actor folders appear in the CREW manifest view.

### Dev Container & User Management

- Added Dev Container configuration for GitHub Codespaces with auto-download of FoundryVTT on container start.
- World auto-configuration now creates 7 user accounts: GameMaster, ship-terminal, and 5 character-specific players (JOHN.WILSON, KAYLA_RYE, LEAH_DAVIS, LYRON_CHAN, VANESSA_MILLER).
- Old users not in the configured list are automatically cleaned up on setup.
- Player passwords use proper PBKDF2 hashing of empty string (compatible with FoundryVTT v13's `testPassword()`) so players can log in without entering a password.
- Per-user command codes and clearance levels are force-written to world settings during setup.

### Bug Fixes

- Fixed CRLF line endings in devcontainer shell scripts that prevented execution on Linux.
- Fixed LOGOUT / REVOKE clearance not updating the terminal view until a manual refresh.
- Fixed GM unable to write per-user clearance settings due to player permission errors (now uses socket relay to GM client).

---

## v1.0.9 — 2026-02-19

### NAV Markers — New Marker Types

- Added DEPARTURE marker type representing the ship's origin point on the star map. Renders with a blue double-ring crosshair and larger footprint than standard markers.
- Added DESTINATION marker type representing the ship's target location. Renders with an amber double-ring crosshair.
- Added PLAYER marker type representing the player ship on the star map. Renders as a directional triangle that points toward the DESTINATION marker with a cyan glow.

### NAV Markers — Travel Path

- A path line is drawn between DEPARTURE and DESTINATION markers when both exist on the map.
- When a PLAYER marker exists, the traversed portion of the path renders as a solid cyan line and the remaining portion renders as a dashed gray line.
- When no PLAYER marker exists, the full path renders as a dashed line.

### NAV Markers — Player Ship Traversal

- PLAYER markers store a progress value (0-100%) representing how far along the DEPARTURE-to-DESTINATION path the ship has traveled.
- PLAYER marker position is computed via linear interpolation along the path rather than stored as fixed coordinates.
- Progress slider appears in the marker creation/edit form when the PLAYER type is selected.
- NAV markers table shows "TRANSIT: XX%" for PLAYER markers instead of raw coordinates.

### NAV Markers — GM Drag-to-Move

- GM can click and drag any marker on the star map to reposition it in real time.
- Drag uses capture-phase mouse handling so it fires before PinchZoomHandler panning, with a 12px hit radius.
- PLAYER markers snap to the DEPARTURE-DESTINATION path line when dragged (projected onto the line segment), automatically updating the progress value.
- All other marker types can be freely dragged to any position on the map.
- Position persists on mouse release and broadcasts to all connected clients.

### NAV — Marker-Driven Properties

- POSITION field now derives from the PLAYER marker when present, showing the marker label and computed coordinates.
- DESTINATION field now derives from the DESTINATION marker label when present.
- Added DST COORDINATES field showing the DESTINATION marker's map coordinates in amber.
- All three fields fall back to manually-set navData values when no markers exist.

### NAV — Layout

- Rebalanced the NAV status table so properties are evenly distributed across both columns. POSITION and DESTINATION now share a row instead of spanning the full width.
- NAV MARKERS list table is now hidden from player terminals (GM-only).

### Event Timers — Systems Dropdown

- When creating a new timer with the ON COMPLETE action set to SET SYSTEM STATE, a SYSTEM dropdown now appears populated with all ship systems from the active ship profile instead of a free-text input.
- Added a SET STATE dropdown with all valid system states: ONLINE, NOMINAL, WARNING, CRITICAL, OFFLINE.
- Selecting SYSTEM as the timer category auto-selects SET SYSTEM STATE and reveals both dropdowns.

### Event Timers — Execution Fix

- Fixed timers with set-system-status actions silently failing when ship systems had never been explicitly saved. The action handler now uses _getSystemsData() which properly falls back to ship profile defaults instead of _loadSetting() which returned an empty array.
- Added console logging on successful system state changes and a warning when a target system name is not found.

---

## v1.0.8 — 2026-02-18

### Stellar Cartography — New SYSTEMS View

- Replaced the MAPS view with a new SYSTEMS (Stellar Cartography) view displaying a searchable database of 63 known star systems across 8 territories.
- Each system entry includes designation, type, territory, sector, coordinates, affiliation, status, description, and celestial bodies.
- 13 systems are gated behind CORPORATE classification, requiring elevated clearance to access.
- Detail view shows full system profile with celestial bodies list.
- Classified systems display an ACCESS DENIED screen with required clearance level.
- GM with MASTER_OVERRIDE clearance can access all systems regardless of classification.

### Stellar Cartography — Filters

- Added TERRITORY, SECTOR, and STATUS filter dropdowns to the systems list.
- Filters combine and update a visible system count tally in real time.

### Stellar Cartography — GM CRUD Management

- GM can CREATE new star systems via a full editor form with all fields and a dynamic celestial bodies editor.
- GM can EDIT existing systems (both base and custom) from inline list buttons or the detail view toolbar.
- GM can DELETE systems with a confirmation dialog from inline list buttons or the detail view toolbar.
- Classification dropdown includes UNCLASSIFIED, MEDICAL, CONFIDENTIAL, SENSITIVE, RESTRICTED, and CORPORATE options.
- Status dropdown includes ACTIVE, SURVEYED, UNEXPLORED, UNKNOWN, REBUILDING, RECONTACTED, QUARANTINE, ABANDONED, DECOMMISSIONED, and CLASSIFIED.
- GM changes persist in world settings as an overlay on the base JSON data (additions, modifications, deletions tracked separately).
- Changes broadcast to player terminals in real time.

### Navigation Button Updates

- Renamed the ship systems nav button from SYSTEMS to SHIP OPS to avoid confusion with the new Stellar Cartography view.

### UI / CSS Fixes

- Fixed systems list not scrolling by adding proper flex container layout.
- Added green scrollbar styling to the systems list for all users.
- Removed color coding from STATUS column and indicator dots on player terminals (green-only rule).
- Fixed all dropdown menus inside the terminal to use consistent dark backgrounds with green text (eliminates white dropdown backgrounds).
- Added catch-all select styling to prevent any dropdown from falling back to browser defaults.

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

### Logs — Audio Waveform Player

- Added AUDIO (MP3/WAV) as a new media type for log entries alongside existing TEXT, IMAGE, and VIDEO options.
- Audio logs display a full waveform visualization using Web Audio API decoding and Canvas 2D rendering.
- Waveform player includes PLAY, PAUSE, and STOP controls with elapsed/total time display.
- Click-to-seek on the waveform canvas.
- Playback progress highlighted on the waveform in real time.
- Audio resources are cleaned up when switching views.

### CRT Effects

- Fixed CRT scanlines being invisible: increased opacity from 0.15 to 0.4 on 2px/4px bands.
- Rewrote CRT flicker as a slow 4-second organic cycle with realistic brightness shifts instead of the previous 0.08s strobe.
- Updated legacy theme scanlines to 0.55 opacity with amber-tinted flicker keyframes.

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
