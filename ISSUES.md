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

- Map Sensors RANGE to something more meaningful and can be reflected in the RADAR. 
- Any SHIP beyond the effective RANGE of Sensors should be invisible or intermittent visibility if on the very edge of SENSOR RANGE..
- Configure visiblity of Internal Sensor Hazards so they can be pre-placed and triggered based on specific events in the game. 

## Future Work (Don't do these until moved under Acctive work)

- Create custom Player Interface that shows the Character Sheet.
- NAVIGATION CHANGES
  - Replace GM Integrated Navigation with SCENE rendered information. 
  - Add NAV Map to SCENE and allow tracking using TOKEN
    - STATION TOKENS
    - SYSTEM TOKENS (small but selectable) to not interfere with map. 
    - SHIP TOKENS
  - Tapping the token brings up an informational window to the RIGHT of NAV MAP with information on STATION, SHIP, SYSTEM pulled directly from the information the token represents in FOUNDRYVTT. 
- Integrate DOORS [Locked/Unlocked] with FoundryVTT MAP Doors to simplify the onbarding.. 
  - Give GM easy way to LOCK/UNOCK all doors with a single button on a specific ship/structure.
  - Wire this into Emergency Settings/Events. 
- New COMPENDIUM
  - WEAPONS
  - GEAR
  - SHIPS
  - WORLDS
  - Etc Etc


## COMPLETED

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