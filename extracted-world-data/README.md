# Extracted World Data

Data extraction and repackaging pipeline for the **Alien RPG** FoundryVTT world and official compendium modules. All game data is pulled from LevelDB compendium packs, serialized to JSON, and organized for analysis, reference, and module building.

> **Dependency:** [classic-level](https://www.npmjs.com/package/classic-level) (LevelDB bindings for Node.js)
>
> Install: `npm install`

---

## Directory Structure

```
extracted-world-data/
├── README.md                    ← You are here
├── ALIEN-WORLDS-REPORT.md       ← Curated reference doc (541 lines)
├── package.json                 ← Node.js project config
│
├── extract-world-data.mjs       ← Script: extract personal world data
├── extract-module-packs.mjs     ← Script: extract official module packs
├── create-module-packs.mjs      ← Script: build custom module LevelDB packs
├── create-cog-actors-pack.mjs   ← Script: build CoG actor compendium
│
├── actors.json                  ← World actors (758 KB)
├── items.json                   ← World items (958 KB)
├── scenes.json                  ← World scenes (447 KB)
├── journal.json                 ← World journal entries (614 KB)
├── tables.json                  ← World roll tables (450 KB)
├── macros.json                  ← World macros (15 KB)
├── folders.json                 ← World folder structure (19 KB)
│
└── modules/                     ← Extracted official module data
    ├── stars-middle-heavens.txt
    ├── alienrpg-corerules/      ← Core Rulebook (5.2 MB)
    ├── alienrpg-bbw/            ← Building Better Worlds (5.7 MB)
    ├── alienrpg-hod/            ← Heart of Darkness (3.4 MB)
    └── alienrpg-starterset/     ← Starter Set / Chariot of the Gods (1.8 MB)
```

---

## Scripts

### `extract-world-data.mjs`

Reads LevelDB databases from the local FoundryVTT world (`alienrpg`) and exports each data collection as a JSON file.

- **Source:** `FoundryVTT/data/worlds/alienrpg/data/`
- **Output:** Root-level JSON files (`actors.json`, `items.json`, etc.)
- **Data types extracted:** actors, items, scenes, macros, journal, tables, playlists, cards, folders

```bash
node extract-world-data.mjs
```

### `extract-module-packs.mjs`

Extracts all pack data from the four official AlienRPG FoundryVTT modules. Adventure documents are flattened — their nested collections (actors, items, scenes, etc.) are broken out into separate typed JSON files.

- **Source:** `FoundryVTT/data/modules/alienrpg-*/packs/`
- **Output:** `modules/<module-id>/` per-type JSON files + `_all.json`
- **Modules processed:**
  - `alienrpg-corerules` — Core Rulebook
  - `alienrpg-bbw` — Building Better Worlds
  - `alienrpg-hod` — Heart of Darkness
  - `alienrpg-starterset` — Starter Set (Chariot of the Gods)

```bash
node extract-module-packs.mjs
```

### `create-module-packs.mjs`

Copies world LevelDB data into clean LevelDB packs for the custom FoundryVTT module (`foundryvtt-alienrpg-module/packs/`). Produces compendium packs for Actors, Items, Scenes, Macros, Journal Entries, and Roll Tables.

```bash
node create-module-packs.mjs
```

### `create-cog-actors-pack.mjs`

Builds the `wyt-cog-actors` compendium pack specifically for the **Chariot of the Gods** scenario. Cherry-picks 24 actors from `actors.json` and organizes them into four folders:

| Folder | Count | Members |
|--------|-------|---------|
| **USCSS MONTERO** | 5 | Leah Davis, Vanessa Miller, John J. Wilson, Kayla Rye, Lyron Cham |
| **USCSS CRONUS** | 6 | Liam Flynn, Ava 6, Albert Johns, Daniel Cooper, Lori Clayton, Valerie Reid |
| **SOTILLO** | 4 | Micky Horton, Adisa Bolaji, Pinion, Helen Bein |
| **CREATURES** | 9 | Mutant, Neomorphic Bloodburster, Infected, Neomorph, Revenant, Neomorphic Motes, Adult Neomorph, Egg Sacs, Beluga-Head |

```bash
node create-cog-actors-pack.mjs
```

---

## World Data JSON Files

These files contain the full extracted data from the personal FoundryVTT `alienrpg` world. Each file is an array of `{ key, doc }` objects where `doc` is the parsed Foundry document.

### `actors.json` — 158 records (759 KB)

All actors from the world, broken down by type:

| Type | Count | Examples |
|------|-------|---------|
| `character` | 14 | Liam Flynn, Leah Davis, Vanessa Miller, Kayla Rye, Micky Horton, Adisa Bolaji |
| `creature` | 29 | Drone (Stage IV), Revenant (Stage III), Neomorph, Beluga-Head, Xenomorph Empress, Deacon, Harvester, Pathogen Stalker "Venator", Xenocobra "Hammerpede" |
| `spacecraft` | 7 | Lockmart Class 7 Excavator Vessel, W-Y Extended Range Colony Ship, Lockmart Borrowdale Colony Carrier, Weyland Heliades-Sev, W-Y Type 20 EEV |
| `vehicles` | 13 | Cheyenne UD-4B Drop Ship, Weyland EVA-7C Pressure Pod, COBB-C/D Helijet, W-Y Class E Lander, WY-37B Cargo Lifter, Daihotai Tractor |
| `synthetic` | 1 | Ava 6 |
| `spacecraftmods` | 64 | Air Scrubbers, Medlab, Science Lab, Hangar, Cargo Bay, Cryo Deck, Salvage Crane, AI, Planetfall Capacity |
| `talent` | 14 | Compassion, Beneath Notice, Pull Rank, Reckless, Overkill, True Grit, Analysis, Personal Safety, The Long Haul |
| `weapon` | 7 | M240 Incinerator, Rexim RXF-M5 EVA Pistol, Armat M41A Pulse Rifle, .357 Magnum, M4A3 Service Pistol, Armat Model 37A2 Shotgun |
| `item` | 9 | MU/TH/UR 6000, MU/TH/UR 9000, Personal Medkit, Surgical Kit, Key Card, Personal Data Transmitter |

### `items.json` — 286 records (958 KB)

| Type | Count | Description |
|------|-------|-------------|
| `colony-initiative` | 72 | BBW colony management — installations, policies, projects |
| `item` | 67 | General equipment and gear |
| `weapon` | 33 | Firearms, melee weapons, heavy weapons |
| `planet-system` | 29 | Star system and planet data cards |
| `agenda` | 22 | Character agendas (personal objectives) |
| `talent` | 21 | Character talents and abilities |
| `armor` | 16 | Body armor, compression suits, helmets |
| `specialty` | 14 | Career specializations |
| `skill-stunts` | 12 | Skill-specific stunt options |

### `scenes.json` — 830 records (447 KB)

6 named scenes (maps / battlemaps):

- **Chariot of the Gods** — Overview / title scene
- **Montero** — USCSS Montero deckplan
- **Cronus Deck A** — USCSS Cronus upper deck
- **Cronus Deck B** — USCSS Cronus mid-upper deck
- **Cronus Deck C** — USCSS Cronus mid-lower deck
- **Cronus Deck D** — USCSS Cronus lower deck / vehicle bay

> The high record count (830) includes embedded tokens, walls, lights, notes, and other scene sub-documents stored in the LevelDB.

### `journal.json` — 80 records (614 KB)

Journal entries covering scenario text, rules references, handouts, and lore:

- **Scenario content:** Chariot of the Gods introduction, acts I–III events, epilogue, NPC descriptions, xenomorph profiles
- **Ship documentation:** USCSS Cronus decks A–D, USCSS Montero, cryo deck, main deck, cargo deck, vehicle bay
- **Rules reference:** Starter Set rules, skills, careers, combat, damage, stress & panic, gear, weapons & armor
- **Art & handouts:** Art of Chariot of the Gods, Art of Alien Starter Set, scenario handouts
- **Reference:** Map legend, MU/TH/ER instructions, module how-to guides

### `tables.json` — 538 records (450 KB)

80 named roll tables including:

- **Planet/System generation** (tables 01–18): System Star, Star Type, Planet Position, Planet Size, Atmosphere, Radiation, Climate, Hydrosphere, Day Length, Global Feature, Axial Tilt, Regional Terrain, Resource Potential, Planet Personality, Colony Sponsorship, Government, Colony Missions, Colony Incidents
- **Creature attacks:** Abomination, Archdeacon, Automation, Biomorph XX121LV, Drone, Harvester, Neomorph, Pathogen variants, Xenomorph stages
- **Injury & condition tables:** Critical Injuries (characters & synthetics), Permanent injuries, Compression Suit Breach
- **Panic & stress:** Panic table, Event tables
- **Colony management:** Colony Situation, Chamber Table, Connection to the Mission

> The high record count (538) includes both the table definitions and their individual result entries.

### `macros.json` — 7 records (15 KB)

| Macro | Type |
|-------|------|
| Build A Better World | script |
| Alien - Player Ad-hoc YZE Dice Roller | script |
| Alien - GM Dice Roller | script |
| Alien - Roll on selected Mother table | script |
| Alien - Roll on selected Creature table | script |
| Damage From Attack | script |
| Activate all Tiles | script |

### `folders.json` — 30 records (19 KB)

Organizational folder structure:

| Folder Type | Count |
|-------------|-------|
| Item | 14 |
| Actor | 7 |
| RollTable | 4 |
| JournalEntry | 3 |
| Scene | 1 |
| Macro | 1 |

---

## Module Extractions (`modules/`)

Each module subdirectory contains:
- `_all.json` — Every document from the module in one file
- `-adventures.json` — Adventure pack metadata (names, descriptions)
- `actors.json` — Actor documents
- `items.json` — Item documents
- `journal.json` — Journal entries
- `scenes.json` — Scene/map documents
- `tables.json` — Roll tables
- `folders.json` — Folder structure
- `macros.json` — Macros (where applicable)

### `alienrpg-corerules/` — Core Rulebook (5.2 MB total)

The base game data. Contains all core actors (creatures, vehicles, spacecraft), the full item catalog (weapons, armor, gear, talents, planet-system cards), Hadley's Hope scenario ("Hope's Last Day"), Stars of the Middle Heavens star map, space combat maps, station layouts, and all 18 planet/system generation tables.

| File | Size |
|------|------|
| actors.json | 1,129 KB |
| items.json | 706 KB |
| journal.json | 1,669 KB |
| scenes.json | 835 KB |
| tables.json | 317 KB |
| folders.json | 19 KB |

### `alienrpg-bbw/` — Building Better Worlds (5.7 MB total)

Colony management expansion. Includes 72 colony-initiative items (installations, policies, projects), the "Lost Worlds" 7-part Far Spinward Colonies campaign, detailed world profiles for 30+ planets, Engineer ruins and artifacts, ships (UNCSS Solovetsky Island, SSV Sokol, UNCSS Ìyánlá), colony maps, and Engineer structure battlemaps.

| File | Size |
|------|------|
| actors.json | 1,907 KB |
| items.json | 356 KB |
| journal.json | 1,403 KB |
| scenes.json | 1,081 KB |
| tables.json | 354 KB |
| folders.json | 22 KB |
| macros.json | 1 KB |

### `alienrpg-hod/` — Heart of Darkness (3.4 MB total)

Erebos Station campaign. Features the 26 Draconis system (Ablassen Black Hole), a fully-mapped 10-deck station (Decks A–J), prison/plasma trawling platform scenario, Living Proto-Hive, the USCSS Cetorhina and The Cheiron ships, and the 26 Draconis Strain pathogen.

| File | Size |
|------|------|
| actors.json | 484 KB |
| items.json | 98 KB |
| journal.json | 508 KB |
| scenes.json | 1,777 KB |
| tables.json | 40 KB |
| folders.json | 12 KB |

### `alienrpg-starterset/` — Starter Set / Chariot of the Gods (1.8 MB total)

Introductory scenario. Contains the USCSS Montero and USCSS Cronus deckplans, 14 pre-generated characters, the full Chariot of the Gods adventure (3 acts + epilogue), starter rules reference, Stars of the Middle Heavens star map, and creature profiles.

| File | Size |
|------|------|
| actors.json | 228 KB |
| items.json | 318 KB |
| journal.json | 546 KB |
| scenes.json | 419 KB |
| tables.json | 63 KB |
| folders.json | 10 KB |

### `stars-middle-heavens.txt`

Text reference file for the Stars of the Middle Heavens star map data (currently empty placeholder).

---

## Reference Document

### `ALIEN-WORLDS-REPORT.md` (541 lines)

A comprehensive hand-curated report synthesizing all extracted module data into a single reference:

1. **Master Systems & Colonies Table** — 80+ worlds organized by territory (Core Systems, Outer Veil, Outer Rim, Frontier, Far Reach, Unclaimed Space, Far Spinward Colonies)
2. **Detailed World Profiles** — 20+ planets with climate, terrain, population, resources, and lore notes
3. **Heart of Darkness — 26 Draconis System** — Ablassen Black Hole, LV-1113, Erebos Station (all 10 decks), the 26 Draconis Strain
4. **Chariot of the Gods** — USCSS Montero, USCSS Cronus, Sutter's World, Anchorpoint Station
5. **Hope's Last Day — Hadley's Hope / LV-426** — Colony blocks A–J, population, scenario overview
6. **Colony Initiative Items** — All 72 BBW installations, policies, and projects
7. **Key Scenes by Module** — Every mapped location organized by source module
8. **BBW Campaign: "The Lost Worlds"** — Full 7-expedition summary with systems, worlds, and scenarios
9. **Major Factions & Organizations** — 16 factions (Weyland-Yutani, 3WE, UA, UPP, ICSC, UNISC, etc.)
10. **Notable Spacecraft & Stations** — 15 named ships and stations with source attribution

---

## How It All Connects

```
FoundryVTT World (LevelDB)          Official Modules (LevelDB)
        │                                      │
        ▼                                      ▼
  extract-world-data.mjs              extract-module-packs.mjs
        │                                      │
        ▼                                      ▼
  Root JSON files                      modules/<id>/*.json
  (actors, items, scenes...)           (per-module, per-type)
        │                                      │
        ▼                                      ▼
  create-cog-actors-pack.mjs     ALIEN-WORLDS-REPORT.md
        │                        (hand-curated synthesis)
        ▼
  foundryvtt-alienrpg-module/
  packs/wyt-cog-actors/          ← LevelDB compendium for the WY-Terminal module
```

The extraction scripts read from live FoundryVTT data, the JSON files serve as an intermediate analysis format, and the build scripts produce LevelDB compendium packs consumed by the [WY-Terminal FoundryVTT module](../foundryvtt-alienrpg-module/).
