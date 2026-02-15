/**
 * Ship Profile Definitions
 * Each profile defines the ship identity, default systems, crew, and UI variant.
 * The GM selects which ship profile the terminal displays.
 */

export const SHIP_PROFILES = {

  /* ─────────────────────────────────────────────────────────────
     USCSS MONTERO — M-Class Starfreighter
     Modern Weyland-Yutani commercial hauler.
     Interface: 2037 (current generation)
     ───────────────────────────────────────────────────────────── */
  montero: {
    id: 'montero',
    name: 'USCSS MONTERO',
    shipClass: 'M-CLASS STARFREIGHTER',
    registry: 'REG# 220-8170421',
    owner: 'WEYLAND-YUTANI CORP.',
    interfaceVersion: '2037',
    uiTheme: 'modern',        // green-screen, clean UI
    muthurModel: '6000 SERIES',
    mission: 'CHARIOTS OF THE GODS',
    defaultPlugin: 'montero',

    defaultSystems: [
      { name: 'REACTOR',         status: 'ONLINE',  detail: 'PWR OUTPUT NOMINAL',  powerPct: 100 },
      { name: 'LIFE SUPPORT',    status: 'ONLINE',  detail: 'O2/CO2 NOMINAL',      powerPct: 100 },
      { name: 'ENGINES',         status: 'ONLINE',  detail: 'FEL DRIVE STANDBY',   powerPct: 100 },
      { name: 'COMMS ARRAY',     status: 'ONLINE',  detail: 'FREQ: STANDARD',      powerPct: 100 },
      { name: 'SENSORS',         status: 'ONLINE',  detail: 'RANGE: 100 AU',       powerPct: 100 },
      { name: 'HULL INTEGRITY',  status: 'NOMINAL', detail: '100%',                powerPct: 100 },
      { name: 'MU/TH/UR UPLINK', status: 'ONLINE',  detail: '6000 SERIES',         powerPct: 100 },
    ],

    defaultCrew: [
      { name: 'MILLER', role: 'CAPTAIN',       location: 'BRIDGE',        status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'CHAM',   role: 'PILOT',         location: 'BRIDGE',        status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'RYLE',   role: 'ROUGHNECK',     location: 'CREW QUARTERS', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'WILSON', role: 'MEDIC',         location: 'MEDBAY',        status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'REID',   role: 'COMPANY AGENT', location: 'CARGO BAY',     status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'DAVIS',  role: 'ROUGHNECK',     location: 'ENGINE ROOM',   status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'LUCAS',  role: 'COMPANY REP',   location: 'LOUNGE',        status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
    ],

    // Nav buttons visible to players (in addition to always-shown ones)
    extraNavButtons: [],

    defaultCargo: [
      { name: 'WY-37B FLATBED CARGO LIFTER ("DAISY")', qty: 1, category: 'VEHICLE', location: 'CARGO BAY', description: 'Weyland-Yutani 37B flatbed cargo lifter. Used for heavy cargo loading and transport operations.' },
      { name: 'HIGH-PRESSURE TRITIUM TANKS', qty: 72, category: 'CARGO', location: 'CARGO BAY', description: 'High-pressure tanks filled with refined Tritium. Primary cargo for delivery contract. CAUTION: Contents under extreme pressure.' },
      { name: 'IRC MK.50 COMPRESSION SUIT', qty: 5, category: 'EQUIPMENT', location: 'EVA LOCKER', description: 'IRC Mk.50 Compression Suits rated for vacuum operations. Standard EVA protective equipment.' },
      { name: 'MK.50 AIR SUPPLY REFILL TANK', qty: 10, category: 'SUPPLIES', location: 'EVA LOCKER', description: 'Replacement air supply tanks for IRC Mk.50 Compression Suits. Each provides 4 hours of breathable atmosphere.' },
      { name: 'M314 MOTION TRACKER', qty: 1, category: 'EQUIPMENT', location: 'BRIDGE', description: 'M314 Motion Tracker. Detects movement within 25m radius. Battery-operated with limited charge.' },
      { name: 'M314 REPLACEMENT BATTERIES', qty: 1, category: 'SUPPLIES', location: 'SUPPLY CLOSET', description: 'Replacement battery pack for M314 Motion Tracker. Single use.' },
      { name: 'CUTTING TORCH', qty: 2, category: 'TOOL', location: 'ENGINEERING', description: 'Industrial cutting torch. Can cut through standard bulkheads and sealed hatches. Requires fuel tank to operate.' },
      { name: 'CUTTING TORCH FUEL TANK', qty: 5, category: 'SUPPLIES', location: 'ENGINEERING', description: 'Replacement fuel tanks for cutting torches. Each provides approximately 30 minutes of continuous use.' },
      { name: 'WATATSUMI DV-303 BOLT GUN', qty: 1, category: 'TOOL', location: 'TOOL LOCKER', description: 'Watatsumi DV-303 industrial bolt gun. Designed for hull repair and construction. Can be used as an improvised weapon.' },
      { name: 'P-5000 POWER LOADER', qty: 1, category: 'VEHICLE', location: 'CARGO BAY', description: 'Caterpillar P-5000 Power Loader. Exoskeletal cargo handling system. Rated for 4-ton lift capacity.' },
    ],
  },

  /* ─────────────────────────────────────────────────────────────
     USCSS CRONUS — C-Class Military Science Vessel
     Older military/research vessel, heavier armament.
     Interface: 2019 (legacy generation — amber accents, rougher UI)
     ───────────────────────────────────────────────────────────── */
  cronus: {
    id: 'cronus',
    name: 'USCSS CRONUS',
    shipClass: 'C-CLASS MILITARY SCIENCE VESSEL',
    registry: 'REG# 110-4756891',
    owner: 'WEYLAND-YUTANI CORP. / USCM',
    interfaceVersion: '2019',
    uiTheme: 'legacy',        // amber tint, rougher typography, older feel
    muthurModel: '2000 SERIES',
    mission: 'CLASSIFIED — LV-1113',
    defaultPlugin: 'cronus',

    defaultSystems: [
      { name: 'REACTOR',            status: 'ONLINE',  detail: 'PWR OUTPUT NOMINAL',     powerPct: 100 },
      { name: 'LIFE SUPPORT',       status: 'ONLINE',  detail: 'O2/CO2 NOMINAL',         powerPct: 100 },
      { name: 'ENGINES',            status: 'ONLINE',  detail: 'FTL DRIVE STANDBY',      powerPct: 100 },
      { name: 'COMMS ARRAY',        status: 'ONLINE',  detail: 'MIL-SPEC ENCRYPTED',     powerPct: 100 },
      { name: 'SENSORS',            status: 'ONLINE',  detail: 'RANGE: 200 AU',          powerPct: 100 },
      { name: 'HULL INTEGRITY',     status: 'NOMINAL', detail: '100%',                   powerPct: 100 },
      { name: 'RAIL GUN',           status: 'ONLINE',  detail: 'ARMED — SAFE',           powerPct: 100 },
      { name: 'MISSILE BATTERY',    status: 'ONLINE',  detail: '12 RDS LOADED',          powerPct: 100 },
      { name: 'POINT DEFENSE SYS',  status: 'ONLINE',  detail: 'AUTO-TRACK ENABLED',     powerPct: 100 },
      { name: 'SCIENCE POD',        status: 'ONLINE',  detail: 'LAB-A / LAB-B ACTIVE',   powerPct: 100 },
      { name: 'CRYO VAULT',         status: 'NOMINAL', detail: 'ALL PODS SEALED',        powerPct: 100 },
      { name: 'MU/TH/UR UPLINK',    status: 'ONLINE',  detail: '2000 SERIES',            powerPct: 100 },
    ],

    defaultCrew: [
      { name: 'ECKFORD',   role: 'CAPTAIN',          location: 'BRIDGE',      status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'JOHNS',     role: 'SCIENCE OFFICER',  location: 'SCIENCE POD', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'COOPER',    role: 'PILOT',            location: 'BRIDGE',      status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'FLYNN',     role: 'WEAPONS OFFICER',  location: 'CIC',         status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'REESE',     role: 'MEDIC',            location: 'MEDBAY',      status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'WEBB',      role: 'ENGINEER',         location: 'ENGINE ROOM', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'TORRES',    role: 'MARINE',           location: 'ARMORY',      status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
    ],

    // Cronus has extra nav options for its military/science systems
    extraNavButtons: [
      { view: 'weapons',  icon: '⊗', label: 'WEAPONS' },
      { view: 'science',  icon: '⚛', label: 'SCIENCE' },
    ],

    defaultCargo: [
      { name: 'CHEMICAL AGENT A0-3959X.91-15 CONTAINMENT UNITS', qty: 20, category: 'HAZMAT', location: '(DECK C) CARGO BAY 1', description: 'Laboratory containment units for Chemical Agent A0-3959X.91-15 (26 Draconis Strain derivative). BIOHAZARD LEVEL 4. Authorized personnel only.' },
      { name: 'SAMPLE STORAGE CYLINDERS (BLACK LIQUID)', qty: 20, category: 'HAZMAT', location: '(DECK C) CARGO BAY 1', description: 'Sealed sample storage cylinders containing black liquid derivative compound. CLASSIFIED. Handle with extreme caution.' },
      { name: 'ENVIRONMENTAL TEST CHAMBER', qty: 5, category: 'EQUIPMENT', location: '(DECK B) SCIENCE LAB A', description: 'Sealed environmental test chambers for controlled atmosphere biological testing. Includes atmosphere, temperature, and pressure regulation.' },
      { name: 'PORTABLE DIAGNOSTIC SCANNER', qty: 10, category: 'EQUIPMENT', location: '(DECK B) SCIENCE LAB B', description: 'Handheld diagnostic scanners for biological and chemical analysis. Can detect anomalous compounds and biological signatures.' },
      { name: 'RESEARCH DATA TABLET', qty: 10, category: 'EQUIPMENT', location: '(DECK B) SCIENCE LAB A', description: 'Data tablets containing classified research logs on pathogen analysis, specimen observations, and experimental results.' },
      { name: 'SPECIMEN CONTAINMENT TANK', qty: 20, category: 'HAZMAT', location: '(DECK C) CARGO BAY 2', description: 'Reinforced specimen containment tanks rated for Class-4 biological specimens. Includes cryogenic suspension capability.' },
      { name: 'SURGICAL EXAMINATION TABLE', qty: 2, category: 'EQUIPMENT', location: '(DECK B) MEDLAB', description: 'Advanced surgical examination tables with integrated bio-monitoring and surgical assistance systems.' },
      { name: 'ARMAT 37A2 12-GAUGE SHOTGUN', qty: 1, category: 'WEAPON', location: 'ARMORY', description: 'Armat 37A2 12-gauge pump-action shotgun. Assigned to Reid. 2 reloads available. Standard colonial security issue.' },
      { name: 'M4A3 SERVICE PISTOL', qty: 2, category: 'WEAPON', location: 'ARMORY', description: 'M4A3 Service Pistol. Standard-issue sidearm. Assigned to Clayton and Johns. Standard ammunition load.' },
      { name: 'SECURITY SIDEARMS (STANDARD ISSUE)', qty: 4, category: 'WEAPON', location: 'ARMORY', description: 'Additional sidearms assigned to security personnel. Standard issue for shipboard security detail.' },
      { name: 'SECURE SECTION ACCESS KEYCARDS', qty: 6, category: 'EQUIPMENT', location: 'BRIDGE', description: 'Access keycards for restricted and secure sections of the vessel. Authorization levels vary by card.' },
      { name: 'STANDARD SHIPBOARD ARMOR', qty: 4, category: 'EQUIPMENT', location: 'ARMORY', description: 'Standard-issue shipboard body armor for security personnel. Provides basic ballistic and impact protection.' },
    ],
  },
};

/**
 * Get a ship profile by id.
 * @param {string} profileId
 * @returns {object}
 */
export function getShipProfile(profileId) {
  return SHIP_PROFILES[profileId] || SHIP_PROFILES.montero;
}

/**
 * Get list of available profiles for UI selectors.
 * @returns {Array<{id: string, label: string}>}
 */
export function getAvailableProfiles() {
  return Object.values(SHIP_PROFILES).map(p => ({
    id: p.id,
    label: `${p.name} (${p.shipClass})`,
  }));
}
