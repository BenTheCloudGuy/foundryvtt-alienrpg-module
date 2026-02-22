/**
 * generate-cronus-dead.mjs
 *
 * Generates actor JSON files for all USCSS CRONUS crew members who do NOT
 * already have actor files (the dead / missing crew).
 *
 * Usage:  node compendium-src/generate-cronus-dead.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'wyt-cog-actors', 'cronus');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId() {
  // 16-char base62 ID matching FoundryVTT style
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(16);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

function fileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '') + '.json';
}

// Skill → Attribute mapping
const SKILL_ATTR = {
  heavyMach: 'str', closeCbt: 'str', stamina: 'str',
  rangedCbt: 'agl', mobility: 'agl', piloting: 'agl',
  command: 'emp', manipulation: 'emp', medicalAid: 'emp',
  observation: 'wit', survival: 'wit', comtech: 'wit',
};

function buildActor(def) {
  const id = generateId();
  const { name, career, appearance, agenda, relOne, relTwo, sigItem, notes,
    str, wit, agl, emp, skills: sk } = def;

  const health = str; // Health max = STR

  // Build skills with mod = attribute + skill value
  const attrs = { str, wit, agl, emp };
  const SKILL_LABELS = {
    heavyMach: 'Heavy Machinery', closeCbt: 'Close Combat', stamina: 'Stamina',
    rangedCbt: 'Ranged Combat', mobility: 'Mobility', piloting: 'Piloting',
    command: 'Command', manipulation: 'Manipulation', medicalAid: 'Medical Aid',
    observation: 'Observation', survival: 'Survival', comtech: 'Comtech',
  };

  const skillsObj = {};
  for (const [key, label] of Object.entries(SKILL_LABELS)) {
    const val = sk[key] || 0;
    const attrKey = SKILL_ATTR[key];
    const mod = attrs[attrKey] + val;
    skillsObj[key] = {
      value: val, label, description: label, mod, max: 0, attrib: ''
    };
  }

  return {
    _id: id,
    name,
    type: 'character',
    img: 'icons/svg/mystery-man.svg',
    items: [],
    effects: [],
    folder: 'cs2JnCLDPQdwJAle',
    sort: 0,
    flags: { core: {} },
    system: {
      header: {
        health: { value: health, label: 'Health', mod: 0, max: health, calculatedMax: health },
        stress: { value: 0, label: 'Stress', mod: 0, max: 10 },
        npc: false,
        resolve: { value: 0, max: 0, mod: 0, label: 'ALIENRPG.Resolve' },
      },
      attributes: {
        str: { value: str, label: 'Strength', mod: str, max: 0 },
        wit: { value: wit, label: 'Wits', mod: wit, max: 0 },
        agl: { value: agl, label: 'Agility', mod: agl, max: 0 },
        emp: { value: emp, label: 'Empathy', mod: emp, max: 0 },
      },
      skills: skillsObj,
      general: {
        career: { value: career },
        appearance: { value: appearance },
        sigItem: { value: sigItem || '' },
        agenda: { value: agenda || '' },
        relOne: { value: relOne || '' },
        relTwo: { value: relTwo || '' },
        xp: { value: 0, max: 20 },
        sp: { value: 0, max: 3 },
        radiation: { value: 0, max: 10, calculatedMax: 10, permanent: 0 },
        starving: false, dehydrated: false, exhausted: false,
        freezing: false, hypoxia: false, gravitydyspraxia: false,
        critInj: { value: 0 },
        armor: { value: 0 },
        panic: { value: 0, lastRoll: 0 },
        cash: { value: '0' },
        encumbrance: { value: 0, max: 0, pct: 0, encumbered: false },
        overwatch: false, fatigued: false, jumpy: false, tunnelvision: false,
        aggravated: false, shakes: false, frantic: false, deflated: false,
        paranoid: false, hesitant: false, freeze: false, seekcover: false,
        scream: false, flee: false, frenzy: false, catatonic: false,
        addpanic: { value: 1 },
        stressresponse: { value: -1 },
      },
      consumables: {
        air: { value: 0 }, power: { value: 0 }, food: { value: 0 }, water: { value: 0 },
      },
      notes: notes || '',
      adhocitems: '',
    },
    prototypeToken: {
      flags: {},
      name,
      displayName: 20,
      width: 1, height: 1,
      lockRotation: false, rotation: 0,
      actorLink: true,
      disposition: 1,
      displayBars: 20,
      bar1: { attribute: 'header.health' },
      bar2: { attribute: 'header.stress' },
      randomImg: false, alpha: 1,
      light: {
        alpha: 1, angle: 360, bright: 0, coloration: 1, dim: 0,
        luminosity: 0.5, saturation: 0, contrast: 0, shadows: 0,
        animation: { speed: 5, intensity: 5, type: null, reverse: false },
        darkness: { min: 0, max: 1 },
        color: null, attenuation: 0.5, negative: false, priority: 0,
      },
      texture: {
        src: 'icons/svg/mystery-man.svg',
        tint: '#ffffff',
        scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0,
        anchorX: 0.5, anchorY: 0.5, fit: 'contain', alphaThreshold: 0.75,
      },
      sight: {
        angle: 360, enabled: true, range: 12, brightness: 0,
        color: null, attenuation: 0.1, saturation: 0, contrast: 0,
        visionMode: 'basic',
      },
      detectionModes: [],
      appendNumber: false, prependAdjective: false,
      occludable: { radius: 0 },
      ring: {
        enabled: false,
        colors: { ring: null, background: null },
        effects: 1,
        subject: { scale: 1, texture: null },
      },
      turnMarker: { mode: 1, animation: null, src: null, disposition: false },
      movementAction: null,
    },
    _stats: {
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null,
      coreVersion: '13.351',
      systemId: 'alienrpg',
      systemVersion: '4.0.10',
      createdTime: Date.now(),
      modifiedTime: Date.now(),
      lastModifiedBy: 'H1vAw0KeNomo6NHk',
    },
    ownership: { default: 0 },
  };
}

// ---------------------------------------------------------------------------
// Crew definitions — all dead / missing CRONUS crew
// ---------------------------------------------------------------------------
const CREW = [
  // ===== COMMAND =====
  {
    name: 'Helena Russo',
    career: '6',  // Officer
    str: 3, wit: 4, agl: 3, emp: 4,
    skills: { command: 3, piloting: 1, observation: 2, manipulation: 1 },
    appearance: 'Captain of the USCSS Cronus\nAge: 45\nPersonality: Caring',
    agenda: 'Bring everyone home alive. No exceptions.',
    relOne: 'Liam Chen', relTwo: 'Albert Johns',
    notes: '<p>Captain Helena Russo commanded the Cronus with quiet authority and genuine care for her crew. A veteran of deep-space exploration with two decades of Weyland service and three prior successful survey missions. She remembered birthdays and knew every crewmember by name. When the situation on LV-1113 deteriorated, she was one of the first to order departure.</p><p><b>STATUS: KIA — LV-1113.</b> Killed during the emergency evacuation on August 2, 2110. Circumstances unclear.</p>',
  },
  {
    name: 'Liam Chen',
    career: '6',  // Officer
    str: 3, wit: 4, agl: 3, emp: 3,
    skills: { command: 2, observation: 2, manipulation: 1, comtech: 1 },
    appearance: 'First Officer on the USCSS Cronus\nAge: 38\nPersonality: Meticulous',
    agenda: 'Keep the ship running smoothly. Back up the Captain at all costs.',
    relOne: 'Helena Russo', relTwo: '',
    notes: '<p>First Officer Liam Chen was Russo\'s right hand — efficient, meticulous, and reserved. He handled the administrative machinery that kept the Cronus running. Respected more than liked; the kind of officer who made sure the duty roster was fair but wouldn\'t be invited for a drink afterward.</p><p><b>STATUS: KIA — LV-1113.</b> Killed alongside Captain Russo during the evacuation on August 2, 2110.</p>',
  },
  {
    name: 'Erik Muller',
    career: '7',  // Pilot
    str: 3, wit: 4, agl: 3, emp: 2,
    skills: { piloting: 3, observation: 2, comtech: 1, mobility: 1 },
    appearance: 'Navigation Officer on the USCSS Cronus\nAge: 36\nPersonality: Precise',
    agenda: 'Plot the safest course. Always have a backup route planned.',
    relOne: 'Irina Sokolov', relTwo: '',
    notes: '<p>Navigation Officer Erik Muller was quiet and precise. He plotted courses with a surgeon\'s care and spent most of his off-hours running simulations. Transferred from a commercial hauler and considered the Cronus assignment the high point of his career.</p><p><b>STATUS: MIA — LV-1113.</b> Failed to reach the ship during the emergency evacuation on August 2, 2110.</p>',
  },

  // ===== SCIENCE =====
  {
    name: 'Marco Fischer',
    career: '10',  // Scientist
    str: 3, wit: 5, agl: 3, emp: 3,
    skills: { observation: 3, survival: 1, comtech: 1, mobility: 1 },
    appearance: 'Xenobiologist on the USCSS Cronus\nAge: 37\nPersonality: Curious',
    agenda: 'Document every lifeform. Get close enough to understand them.',
    relOne: 'Daniel Cooper', relTwo: 'Elias Ritter',
    notes: '<p>Xenobiologist Marco Fischer was Cooper\'s protégé and closest confidant in the science department. Energetic and curious to a fault, he had a habit of getting too close to specimens. Cooper had written him up twice for breach of containment protocol. Fischer always apologized, always meant it, and always did it again.</p><p><b>STATUS: KIA — LV-1113.</b> At the science module when it was overrun on August 2, 2110.</p>',
  },
  {
    name: 'Elias Ritter',
    career: '10',  // Scientist
    str: 2, wit: 5, agl: 3, emp: 3,
    skills: { observation: 3, comtech: 2, survival: 1 },
    appearance: 'Xenoarcheologist on the USCSS Cronus\nAge: 29\nPersonality: Enthusiastic',
    agenda: 'Make the discovery of a lifetime. Prove the existence of alien civilization.',
    relOne: 'Marco Fischer', relTwo: 'Linh Nguyen',
    notes: '<p>The youngest member of the science team. Elias Ritter was on his first deep-space assignment and treated the mission with breathless enthusiasm. Brilliant with ancient structures and alien artifacts. He discovered the ruins on LV-1113 and was the first inside. Attacked by a native creature on August 1 and quarantined in the med lab with accelerating cellular changes.</p><p><b>STATUS: KIA — USCSS CRONUS.</b> Survived the emergency launch but was quarantined in med lab. Did not make it to the cryo vault during the creature incursion aboard the ship.</p>',
  },
  {
    name: 'Amina Hussain',
    career: '10',  // Scientist
    str: 3, wit: 4, agl: 3, emp: 3,
    skills: { observation: 2, comtech: 2, survival: 2, heavyMach: 1 },
    appearance: 'Exogeologist on the USCSS Cronus\nAge: 41\nPersonality: Cautious',
    agenda: 'Understand this world\'s geological history. Flag any anomalies.',
    relOne: 'Daniel Cooper', relTwo: '',
    notes: '<p>Grounded and methodical. Amina Hussain studied the bones of worlds — geological history, mineral composition, tectonic patterns. The closest thing the science team had to a voice of caution. She was one of the first to argue for immediate departure when things went wrong. Her geological surveys flagged soil anomalies consistent with artificial biological acceleration.</p><p><b>STATUS: KIA — LV-1113.</b> Confirmed killed at the science module on August 2, 2110.</p>',
  },
  {
    name: 'Yuna Kim',
    career: '10',  // Scientist
    str: 2, wit: 5, agl: 2, emp: 3,
    skills: { observation: 3, comtech: 3, survival: 1 },
    appearance: 'Astrochemist on the USCSS Cronus\nAge: 32\nPersonality: Particular',
    agenda: 'Analyze every compound. Report anything anomalous, no matter how minor.',
    relOne: 'Samira Alavi', relTwo: '',
    notes: '<p>Precise and particular about her work. Yuna Kim analyzed atmospheric and chemical compositions. Her initial readings of LV-1113\'s atmosphere proved prescient — she flagged several anomalous compounds in her first report that no one took seriously enough.</p><p><b>STATUS: MIA — LV-1113.</b> Failed to reach the ship during the emergency evacuation on August 2, 2110.</p>',
  },
  {
    name: 'Samira Alavi',
    career: '10',  // Scientist
    str: 2, wit: 5, agl: 3, emp: 3,
    skills: { observation: 2, comtech: 2, medicalAid: 2, survival: 1 },
    appearance: 'Biochemist on the USCSS Cronus\nAge: 30\nPersonality: Focused',
    agenda: 'Identify and classify every pathogen. Contain anything dangerous.',
    relOne: 'Yuna Kim', relTwo: 'Daniel Cooper',
    notes: '<p>Samira Alavi worked closely with Cooper on pathogen analysis. When biological samples arrived from LV-1113, she was the first to note the mutagenic properties of Chemical Agent A0-3959X.91-15. Her lab notes, had they survived Clayton\'s data purge, would have been the most valuable documents aboard.</p><p><b>STATUS: MIA — LV-1113.</b> Failed to reach the ship during the emergency evacuation on August 2, 2110.</p>',
  },
  {
    name: 'Avery Johnson',
    career: '10',  // Scientist
    str: 3, wit: 4, agl: 3, emp: 3,
    skills: { observation: 2, comtech: 2, survival: 1 },
    appearance: 'Organic Chemist on the USCSS Cronus\nAge: 41\nPersonality: Quiet',
    agenda: 'Do good work. Let the data speak for itself.',
    relOne: '', relTwo: '',
    notes: '<p>Avery Johnson handled the molecular analysis side of the bio lab. A quiet, steady presence who preferred to let his work speak for itself.</p><p><b>STATUS: MIA — LV-1113.</b> Failed to reach the ship during the emergency evacuation on August 2, 2110.</p>',
  },
  {
    name: 'Tara Singh',
    career: '10',  // Scientist
    str: 2, wit: 5, agl: 2, emp: 3,
    skills: { comtech: 3, observation: 2, manipulation: 1 },
    appearance: 'Data Analyst on the USCSS Cronus\nAge: 45\nPersonality: Meticulous',
    agenda: 'Archive everything. Make the data accessible and redundant.',
    relOne: '', relTwo: 'Lori Clayton',
    notes: '<p>Tara Singh compiled, organized, and archived the mountain of data the science team generated. She maintained the research databases and handled data transmission protocols. Her meticulous indexing made Lori Clayton\'s later data theft both easier and more complete.</p><p><b>STATUS: MIA — LV-1113.</b> Failed to reach the ship during the emergency evacuation on August 2, 2110.</p>',
  },
  {
    name: 'Linh Nguyen',
    career: '10',  // Scientist
    str: 2, wit: 5, agl: 3, emp: 4,
    skills: { observation: 3, comtech: 1, manipulation: 2, survival: 1 },
    appearance: 'Cultural Anthropologist on the USCSS Cronus\nAge: 34\nPersonality: Perceptive',
    agenda: 'Find evidence of who built the ruins and understand why.',
    relOne: 'Elias Ritter', relTwo: '',
    notes: '<p>An unusual addition to a scientific survey team — her presence suggested someone at Weyland expected to find evidence of intelligent life. They were right. Nguyen documented hundreds of pictographic markings inside the ruins, identifying instructional sequences depicting biological transformation by the Engineers.</p><p><b>STATUS: KIA — LV-1113.</b> Killed near the ruins during the emergency evacuation on August 2, 2110.</p>',
  },

  // ===== ENGINEERING =====
  {
    name: 'Alexei Ivanov',
    career: '8',  // Roughneck
    str: 5, wit: 3, agl: 3, emp: 3,
    skills: { heavyMach: 3, stamina: 2, comtech: 2, observation: 1 },
    appearance: 'Chief Engineer on the USCSS Cronus\nAge: 48\nPersonality: Devoted',
    agenda: 'Keep the Cronus running no matter what. She\'s more than a ship.',
    relOne: 'Zoe Martinez', relTwo: '',
    notes: '<p>A bear of a man who spoke to the Cronus\'s engines the way another man might speak to a horse. Alexei Ivanov had kept older ships than this running on nothing but spare parts and profanity. He carried a deep, genuine love for the ship and treated every hull plate and pipe junction as if it were a living thing under his care.</p><p><b>STATUS: MIA — LV-1113.</b> Last heard on radio from the science module on August 2, 2110.</p>',
  },
  {
    name: 'Zoe Martinez',
    career: '8',  // Roughneck
    str: 4, wit: 3, agl: 4, emp: 3,
    skills: { heavyMach: 3, stamina: 1, comtech: 1, observation: 1, mobility: 1 },
    appearance: 'Mechanical Engineer on the USCSS Cronus\nAge: 35\nPersonality: Resourceful',
    agenda: 'Fix anything that breaks. Improvise when parts run out.',
    relOne: 'Alexei Ivanov', relTwo: '',
    notes: '<p>Ivanov\'s most trusted subordinate. Zoe Martinez could diagnose a mechanical fault by sound alone. Famous aboard the Cronus for once repairing the secondary coolant pump with a piece of cafeteria cutlery.</p><p><b>STATUS: MIA — LV-1113.</b> Last heard on radio from the science module on August 2, 2110. Her final transmission reported creatures breaching the module perimeter.</p>',
  },
  {
    name: 'Miles O\'Connor',
    career: '8',  // Roughneck
    str: 3, wit: 4, agl: 3, emp: 3,
    skills: { comtech: 3, heavyMach: 2, observation: 1, stamina: 1 },
    appearance: 'Electrical Engineer on the USCSS Cronus\nAge: 34\nPersonality: Morbid Humor',
    agenda: 'Keep the lights on and the power flowing. Crack jokes about death.',
    relOne: 'Alexei Ivanov', relTwo: 'Connor Smith',
    notes: '<p>Handled the Cronus\'s power distribution, lighting systems, and electrical grid. Miles O\'Connor was meticulous, kept detailed maintenance logs, and had a morbid sense of humor that got darker the deeper they got into space.</p><p><b>STATUS: MIA — LV-1113.</b> Failed to reach the ship during the emergency evacuation on August 2, 2110.</p>',
  },
  {
    name: 'Connor Smith',
    career: '8',  // Roughneck
    str: 4, wit: 3, agl: 3, emp: 3,
    skills: { heavyMach: 2, stamina: 2, comtech: 1, mobility: 1 },
    appearance: 'Propulsion Engineer on the USCSS Cronus\nAge: 29\nPersonality: Eager',
    agenda: 'Learn everything Ivanov can teach. Keep the engines purring.',
    relOne: 'Alexei Ivanov', relTwo: 'Miles O\'Connor',
    notes: '<p>The youngest of the engineering team. Connor Smith maintained the four ion plasma engines and worked closely with Ivanov on FTL drive operations. He had a promising career ahead of him.</p><p><b>STATUS: MIA — LV-1113.</b> Failed to reach the ship during the emergency evacuation on August 2, 2110.</p>',
  },

  // ===== MEDICAL =====
  {
    name: 'Isaac Tremblay',
    career: '5',  // Medic
    str: 3, wit: 4, agl: 2, emp: 5,
    skills: { medicalAid: 3, observation: 2, command: 1, comtech: 1 },
    appearance: 'Chief Medical Officer on the USCSS Cronus\nAge: 50\nPersonality: Unshakeable',
    agenda: 'Keep the crew healthy. Document everything clinical. Miss nothing.',
    relOne: 'Liam Flynn', relTwo: 'Daniel Cooper',
    notes: '<p>Twenty-six years of starship medical service had given Isaac Tremblay an unshakeable calm and comprehensive knowledge of every way the human body could fail in deep space. He ran the med lab with two Pauling Medpods and the kind of quiet competence that made people feel safe. He was among the first to notice abnormal cellular changes in Ritter\'s wounds.</p><p><b>STATUS: DECEASED — USCSS CRONUS CRYO POD 13.</b> Survived the emergency launch and entered hypersleep. Died during the 75-year drift when cryogenic systems degraded. No vitals detected at MU/TH/UR restart on March 9, 2185.</p>',
  },
  {
    name: 'Noah Schwartz',
    career: '10',  // Scientist (psychologist)
    str: 2, wit: 5, agl: 2, emp: 5,
    skills: { observation: 3, manipulation: 2, medicalAid: 1, command: 1 },
    appearance: 'Psychologist on the USCSS Cronus\nAge: 37\nPersonality: Perceptive',
    agenda: 'Monitor crew mental health. Identify problems before they become crises.',
    relOne: '', relTwo: '',
    notes: '<p>Assigned to monitor crew mental health during the extended mission. Noah Schwartz kept detailed psychological profiles on every crewmember. His notes on the crew\'s deteriorating morale in the final days on LV-1113 would have made disturbing reading. He circulated among the survivors after the evacuation doing what he could.</p><p><b>STATUS: KIA — USCSS CRONUS.</b> Survived the emergency launch from LV-1113 but was killed during the creature incursion aboard the ship. Did not reach the cryo vault.</p>',
  },

  // ===== SECURITY =====
  {
    name: 'Don Jackson',
    career: '1',  // Colonial Marine
    str: 4, wit: 3, agl: 4, emp: 2,
    skills: { rangedCbt: 2, closeCbt: 2, stamina: 1, observation: 2, mobility: 1 },
    appearance: 'Security Officer on the USCSS Cronus\nAge: 42\nPersonality: Steady',
    agenda: 'Watch the perimeter. Report threats. Protect the crew.',
    relOne: 'Valerie Reid', relTwo: 'Sven Eriksson',
    notes: '<p>Don Jackson had been doing private security for Weyland for fifteen years. Steady and reliable, he was Reid\'s second and handled the routine security work. On August 1, he drove off the creature that attacked Ritter with two shots. On the final day, he reported contacts at the perimeter that didn\'t flinch from gunfire.</p><p><b>STATUS: MIA — LV-1113.</b> Last heard on radio pinned at the north ridge on August 2, 2110. Could not reach the ship.</p>',
  },
  {
    name: 'Sven Eriksson',
    career: '1',  // Colonial Marine
    str: 4, wit: 3, agl: 3, emp: 2,
    skills: { rangedCbt: 2, closeCbt: 1, heavyMach: 2, stamina: 1, observation: 1 },
    appearance: 'Armorer on the USCSS Cronus\nAge: 37\nPersonality: Efficient',
    agenda: 'Maintain the weapons. Track every round. Be ready.',
    relOne: 'Don Jackson', relTwo: 'Valerie Reid',
    notes: '<p>Maintained the armory and all weapons systems. Sven Eriksson was quiet, efficient, and kept the weapons in perfect working order. He maintained an unofficial weapons log tracking every round issued and returned. During the ship creature incursion, he opened the armory and distributed weapons, then laid down suppressing fire on C Deck alongside Reid.</p><p><b>STATUS: KIA — USCSS CRONUS.</b> Survived the emergency launch from LV-1113 but was killed during the creature incursion aboard the ship. He was hit on the C Deck catwalk but kept shooting until he couldn\'t anymore.</p>',
  },

  // ===== SUPPORT =====
  {
    name: 'Kenji Watanabe',
    career: '7',  // Pilot (comms)
    str: 3, wit: 4, agl: 3, emp: 3,
    skills: { comtech: 3, observation: 2, piloting: 1 },
    appearance: 'Communications Officer on the USCSS Cronus\nAge: 36\nPersonality: Diligent',
    agenda: 'Keep the comms working. Make sure every message gets through.',
    relOne: '', relTwo: '',
    notes: '<p>Kenji Watanabe handled all ship-to-ground and ship-to-corporate communications. Also responsible for maintaining the long-range comms array and encryption protocols. During the evacuation chaos, he relayed Martinez\'s desperate radio transmissions from the overrun science module.</p><p><b>STATUS: DECEASED — USCSS CRONUS CRYO POD 15.</b> Survived the emergency launch and entered hypersleep. Died during the 75-year drift when cryogenic systems degraded. No vitals detected at MU/TH/UR restart on March 9, 2185.</p>',
  },
  {
    name: 'Grace O\'Malley',
    career: '8',  // Roughneck
    str: 3, wit: 3, agl: 3, emp: 3,
    skills: { heavyMach: 1, stamina: 1, comtech: 1, observation: 2, manipulation: 1 },
    appearance: 'Quartermaster on the USCSS Cronus\nAge: 41\nPersonality: Practical',
    agenda: 'Track every calorie and spare part. If someone needs something, find it.',
    relOne: 'Jasper Thomson', relTwo: '',
    notes: '<p>Grace O\'Malley managed supplies, provisions, and logistics with an iron fist. She was the crew\'s unofficial problem-solver — need something, ask Grace. After the evacuation, she noted supply status was good for 90 days but reported unease about LV-1113.</p><p><b>STATUS: KIA — USCSS CRONUS.</b> Survived the emergency launch from LV-1113 but was killed during the creature incursion aboard the ship. Did not reach the cryo vault.</p>',
  },
  {
    name: 'Jasper Thomson',
    career: '8',  // Roughneck
    str: 4, wit: 3, agl: 3, emp: 3,
    skills: { heavyMach: 2, stamina: 2, mobility: 1, observation: 1 },
    appearance: 'Cargo Supervisor on the USCSS Cronus\nAge: 45\nPersonality: Reliable',
    agenda: 'Secure the cargo. Nothing shifts, nothing breaks, nothing gets lost.',
    relOne: 'Grace O\'Malley', relTwo: '',
    notes: '<p>Jasper Thomson oversaw the cargo bays on Deck C. He handled heavy equipment, mineral extractors, and loading procedures for scientific samples. A reliable presence who kept C Deck organized.</p><p><b>STATUS: KIA — USCSS CRONUS.</b> Survived the emergency launch from LV-1113 but was killed during the creature incursion aboard the ship. Did not reach the cryo vault.</p>',
  },
  {
    name: 'Irina Sokolov',
    career: '7',  // Pilot
    str: 2, wit: 4, agl: 4, emp: 3,
    skills: { piloting: 2, comtech: 2, observation: 1, mobility: 1 },
    appearance: 'Navigation Officer (Secondary) on the USCSS Cronus\nAge: 29\nPersonality: Ambitious',
    agenda: 'Assist Muller. Prove you can handle primary navigation.',
    relOne: 'Erik Muller', relTwo: '',
    notes: '<p>Secondary navigation officer who assisted Muller and handled plotting during off-shifts. Irina Sokolov was young and ambitious — she saw the Cronus mission as her ticket to a primary nav position on a future assignment.</p><p><b>STATUS: KIA — USCSS CRONUS.</b> Survived the emergency launch from LV-1113 but was killed during the creature incursion aboard the ship. Was on the bridge when the explosion occurred.</p>',
  },
  {
    name: 'Anne Chen',
    career: '8',  // Roughneck
    str: 3, wit: 3, agl: 3, emp: 4,
    skills: { survival: 2, observation: 1, manipulation: 1, stamina: 1 },
    appearance: 'Culinary Specialist on the USCSS Cronus\nAge: 35\nPersonality: Warm',
    agenda: 'Feed the crew well. A good meal can save morale when nothing else can.',
    relOne: '', relTwo: '',
    notes: '<p>The crew\'s cook. On a ship where morale could make or break a mission, Anne Chen\'s role was more important than most realized. She turned reconstituted protein and hydroponic vegetables into meals that almost tasted like home. The mess hall was her kingdom, and she ruled it well.</p><p><b>STATUS: KIA — USCSS CRONUS.</b> Survived the emergency launch from LV-1113 but was killed during the creature incursion aboard the ship. Was on the bridge when the explosion occurred.</p>',
  },
  {
    name: 'Jesse Moore',
    career: '7',  // Pilot
    str: 3, wit: 4, agl: 4, emp: 2,
    skills: { piloting: 3, comtech: 1, observation: 1, mobility: 1, rangedCbt: 1 },
    appearance: 'Helmsman on the USCSS Cronus\nAge: 33\nPersonality: Blunt',
    agenda: 'Fly the ship. Get everyone where they need to go.',
    relOne: 'Erik Muller', relTwo: 'Irina Sokolov',
    notes: '<p>Ship\'s helmsman responsible for piloting the Cronus during manual flight operations. Jesse Moore was blunt and no-nonsense, preferring actions over words. After the evacuation, Johns ordered Moore to plot a course to the nearest station. Moore\'s profane final log entry from the bridge — "Mother you [EXPLETIVE] [EXPLETIVE] [EXPLETIVE]—" — was the last transmission before the bridge explosion.</p><p><b>STATUS: KIA — USCSS CRONUS.</b> Survived the emergency launch from LV-1113 but was killed during the bridge explosion on August 2, 2110.</p>',
  },
];

// ---------------------------------------------------------------------------
// Generate files
// ---------------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const def of CREW) {
  const actor = buildActor(def);
  const file = fileName(def.name);
  const outPath = join(OUT_DIR, file);
  writeFileSync(outPath, JSON.stringify(actor, null, 2) + '\n');
  console.log(`  ✓ ${file.padEnd(28)} ${def.name}`);
  count++;
}

console.log(`\nGenerated ${count} actor files in ${OUT_DIR}`);
