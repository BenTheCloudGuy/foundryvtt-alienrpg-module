# ISSUES

## DevServer/Environment Notes

- Current Dev environment is running on locally installed FoundryVTT
- Hostname: http://localhost:30000
- DataDir: C:\Users\bemitchell\OneDrive\FoundryVTT\data
- FoundryVTTDir: C:\Users\bemitchell\OneDrive\FoundryVTT
- ModuleDir: C:\Users\bemitchell\OneDrive\FoundryVTT\data\modules\wy-terminal

## Instructions

- If you are unsure on anything I'm asking for, ask me follow up questions so we can land on the correct solution.. I may say I don't care and then you can just figure it out. 
- Always keep CHANGELOG.md upto date with each batch of changes we implement.



## Active Work





- Create Players/Users
- Create SpaceShips for Chariot of the Gods with details on each ship.
- It looks like Players can see ALL Scenes under schematics. We need to make sure they only see the ones GM enables for them. 
- Missing EMERGENCY PROTOCOL: COLISION ALERT..
  - SHIP LOCKDOWN will trigger "LOCK ALL DOORS" call. Lifting that will set doors to unlocked.


## Future Work (Don't do these until moved under Acctive work)

- Fix Character labels to reference Actor | NOTES | LABEL: {STRING} if that value isn't there then default to using name.
- [ARRIVED AT DESTINATION] is spamming LOGS
- Allow GM to send message and have it LOGGED in the [LOGS].
- Have GM be able to trigger "INCOMING TRANSMISSION warning and have COMMS start blinking like we do with LOGS when a new log is created. Be sure to LOG the Incoming Transmission Notification under LOGS
- Create custom Player Interface that shows the Character Sheet.
- Add Additional Players
  - Each PC for dedicated CharacterSheet App
  - Dedicated VTT MAP.
- Need to find a way to update NAVIGATION STAR MAP with all systems.
- New COMPENDIUM
  - WEAPONS
  - GEAR
  - SHIPS
  - WORLDS
  - Etc Etc
- Update Defaults for Module
  - Include Ships
  - Include Systems
  - Include Items
  - Include Default SCENES


## COMPLETED

- Active Navigation
  - I want to be able to set a "Destination" on the NAVIGATION SCENE and have the ship track toward that destination based on the SPEED..  
    - NAVIGATION INFORMATION under [NAV] should keep accurate realtime information based on Current Position to Destination / Speed. 
    - Update ETA, POSITION, DST Coordinates, Destination, FUEL Reserves (should count down as fuel is consumed), and provide accurate heading.
    - Add [SET COURSE] button to NAV info when Selecting Object (Ship, System, Station). Updating the speed will update ETA before [SET COURSE]

- Question Only - lets work on a plan of attack for this feature:
  -  I just realized that ALIENRPG doesn't support "Actors/Tokens" for Systems.
  -  I want to create an addon to Actors for Systems that is part of my WY-Terminal Module, allowing users to add support for Systems..
  -  I would like the module to ship via module compendium called "ACTORS" to ease importing those objects into [05. SYSTEMS] Folders.
  -  Currently Systems are showing up as "Items" which at least gives us a data source for all the available systems, the basic information on them.
  -  We need to map out the System/Sector information into coordinates so we can easily import them into the NAVIGATION SCENE accurately.
  -  Also I want to create a monochrome green image of each planet. 
  -  Use AI to fetch information for each system from online and update/populate description details.

- NAV interactive green star chart: rendered black+stars+grid with SOL at 0,0, coordinate numbers, live distance/ETA from the player ship, SYSTEM dossiers from cartography DB, GM CONFIGURE NAV SCENE + PLOT KNOWN SYSTEMS.

- NAV opens locked onto the active player ship (activeShip on the GM screen, e.g. MONTERO/CRONUS) — auto-centres and zooms in on the matching SHIP token.
- NAV contact names are hidden until a contact is selected, except SHIP (players' location) tokens which always show their name.
- SCHEMATICS shows the selected ship map only — removed player/crew token overlay and roster (crew tracking stays on SENSORS ▸ INTERNAL).
- NAV tokens are sized from their actual token size on the NAVIGATION scene (no longer oversized).
- NAVIGATION: replaced GM marker nav with a scene-driven star chart (scene named NAV) — STATION/SYSTEM/SHIP tokens rendered as selectable blips, live-tracked; tapping a blip shows an info panel (right of the map) pulled from the linked Foundry actor. GM types tokens via a NAV TYPE selector (token flag).
- Map Sensors RANGE to something more meaningful and can be reflected in the RADAR. 
- Any SHIP beyond the effective RANGE of Sensors should be invisible or intermittent visibility if on the very edge of SENSOR RANGE..
- Configure visiblity of Internal Sensor Hazards so they can be pre-placed and triggered based on specific events in the game.
- Changing Scenes should not force Player Interface to change to SCHEMATICS Page. 
- SENSORS MAP Token Tracker isn't aligning with the SCENE, tokens are off by a little bit.
- Integrate DOORS [Locked/Unlocked] with FoundryVTT MAP Doors to simplify the onbarding.. 
  - Give GM easy way to LOCK/UNOCK all doors with a single button on a specific ship/structure.
  - Wire this into Emergency Settings/Events. 
- RADARs Target Data should read Information on object. 
  - NAME
  - MODEL/CLASS
  - MANUFACTURE
  - ARMAMENTS
    - Offensive
    - Defensive
  - MODULES/UPGRADES
  - CREW
  - LENGTH
  - HULL
  - ARMOR
  - DAMAGE
  - CREW IF KNOWN.
  - NOTES section is not displaying correctly.. Just showing [object Object] vs the actual notes.
- I need to import all Content from AlienRPG into FoundryVTT so I can add ship information more easily.
- Door Locked/Unlocked should be an icon (Red PadLock) for locked and (Green PadLock) for Unlocked
- hazards should be same Hazard Sign for all things.
  - FIRE is YELLOW box WITH word FIRE 
  - RADIATION is YELLOW box WITH RADIATION and # RADS (amount of radiation)
  - DAMAGE Is large RED BOX (adjustable) covering area that is damaged
  - NO OS/AIR is BOX WITH O2 Symbol in it
- GM RADAR is scrolling out of bounds.. We need to rework this.. 
  - Instead of using GM Settings Exclusively.. I created a new SCENE called [RADAR].. 
  - I want you to create the same graphic you used for the RADAR in SENSORS and add it as a background to that SCENE. 
  - Then Size it so it lines up and then when I drop a [SPACECRAFT] token on that SCENE it is tracked by RADAR under SENSORs. 
  - Moving the TOKEN should be reflected on the RADAR in realtime.
  - The Size of the Token should be relative to the size of the blip on the RADAR.
  - READ TARGET DATA from SPACECRAFT notes field. 
  - Calculate Bearing and Distance based on where it is on the SCENE/MAP
- The internal Sensors tracker animation for the individual objects is too much. Don't do the resize or color change..
- Create a new CHANGELOG.md and keep it upto date with any changes we make in our efforts.
- The RADAR image didn't populate in the background of the SCENE in foundryVTT - fix that! 
- Only update the position of the object on the RADAR screen AFTER the scan bar passes the object so it behaves more like how an old school RADAR/SONAR works in the Movies.