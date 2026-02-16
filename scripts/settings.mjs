/**
 * Module Settings Registration
 */

export function registerSettings() {
  // Active ship profile — GM switches between ships
  game.settings.register('wy-terminal', 'activeShip', {
    name: 'Active Ship Profile',
    hint: 'Which ship the terminal is configured for. Changes ship identity, systems, and UI theme.',
    scope: 'world',
    config: false,  // Managed from in-terminal CONFIG
    type: String,
    default: 'montero',
  });

  game.settings.register('wy-terminal', 'shipName', {
    name: 'Ship Name',
    hint: 'The name of the vessel displayed in the terminal.',
    scope: 'world',
    config: true,
    type: String,
    default: 'USCSS MONTERO',
  });

  game.settings.register('wy-terminal', 'shipClass', {
    name: 'Ship Class',
    hint: 'Class designation of the vessel.',
    scope: 'world',
    config: true,
    type: String,
    default: 'M-CLASS STARFREIGHTER',
  });

  game.settings.register('wy-terminal', 'shipRegistry', {
    name: 'Ship Registry',
    hint: 'Registration number of the vessel.',
    scope: 'world',
    config: true,
    type: String,
    default: 'REG# 220-8170421',
  });

  game.settings.register('wy-terminal', 'missionName', {
    name: 'Mission Name',
    hint: 'Current mission designation.',
    scope: 'world',
    config: true,
    type: String,
    default: 'CHARIOTS OF THE GODS',
  });

  game.settings.register('wy-terminal', 'muthurUrl', {
    name: 'MU/TH/UR Server URL',
    hint: 'URL where the MuthurGPT web interface is accessible (leave blank for built-in chat).',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  });

  game.settings.register('wy-terminal', 'statusPath', {
    name: 'Status File Path',
    hint: 'Path to the ship status JSON files within the Foundry data directory.',
    scope: 'world',
    config: true,
    type: String,
    default: 'modules/wy-terminal/status',
  });

  game.settings.register('wy-terminal', 'scanlines', {
    name: 'CRT Scanlines',
    hint: 'Enable CRT scanline overlay effect.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('wy-terminal', 'crtFlicker', {
    name: 'CRT Flicker',
    hint: 'Enable subtle CRT flicker animation.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('wy-terminal', 'soundEnabled', {
    name: 'Terminal Sound Effects',
    hint: 'Enable terminal beep and keyboard sounds.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('wy-terminal', 'terminalWidth', {
    name: 'Terminal Width',
    hint: 'Width of the terminal window in pixels (Normal mode only — ignored in Terminal Display mode).',
    scope: 'client',
    config: true,
    type: Number,
    default: 1200,
  });

  game.settings.register('wy-terminal', 'terminalHeight', {
    name: 'Terminal Height',
    hint: 'Height of the terminal window in pixels (Normal mode only — ignored in Terminal Display mode).',
    scope: 'client',
    config: true,
    type: Number,
    default: 800,
  });

  // Internal: persisted ship status data
  game.settings.register('wy-terminal', 'shipStatusData', {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  });

  // Internal: ship maps configuration
  game.settings.register('wy-terminal', 'maps', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Internal: log entries
  game.settings.register('wy-terminal', 'logEntries', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Internal: crew roster
  game.settings.register('wy-terminal', 'crewRoster', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Internal: ship systems
  game.settings.register('wy-terminal', 'shipSystems', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Internal: cargo manifest
  game.settings.register('wy-terminal', 'cargoManifest', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Internal: comm frequency (###.## format, no MHz suffix)
  game.settings.register('wy-terminal', 'commFrequency', {
    scope: 'world',
    config: false,
    type: String,
    default: '475.12',
  });

  // Internal: game clock epoch (ms since JS epoch for the in-game date/time)
  // Default: 2183-06-12 06:00 UTC
  game.settings.register('wy-terminal', 'gameClockEpoch', {
    scope: 'world',
    config: false,
    type: Number,
    default: Date.UTC(2183, 5, 12, 6, 0, 0),
  });

  // Internal: real-world anchor timestamp (Date.now() when epoch was last set)
  game.settings.register('wy-terminal', 'gameClockRealAnchor', {
    scope: 'world',
    config: false,
    type: Number,
    default: 0,
  });

  /* ════════════════════════════════════════════════════════════════
     MU/TH/UR ENGINE SETTINGS
     ════════════════════════════════════════════════════════════════ */

  game.settings.register('wy-terminal', 'openaiApiKey', {
    name: 'OpenAI API Key',
    hint: 'Your OpenAI API key for MU/TH/UR AI responses. Stored per-world. Leave blank to disable AI.',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  });

  game.settings.register('wy-terminal', 'openaiModel', {
    name: 'OpenAI Model',
    hint: 'The OpenAI model to use (e.g. gpt-4o-mini, gpt-4o, gpt-4.1-nano).',
    scope: 'world',
    config: true,
    type: String,
    default: 'gpt-4o-mini',
  });

  game.settings.register('wy-terminal', 'muthurPlugin', {
    name: 'MU/TH/UR Scenario Plugin',
    hint: 'Which scenario/ship plugin to load for MU/TH/UR prompts and configuration.',
    scope: 'world',
    config: true,
    type: String,
    default: 'cronus',
    choices: {
      montero: 'USCSS Montero',
      cronus: 'USCSS Cronus',
      cronus_life_support: 'USCSS Cronus (Life Support)',
      fort_nebraska: 'Fort Nebraska',
    },
  });

  // Internal: persisted MU/TH/UR engine conversation
  game.settings.register('wy-terminal', 'muthurConversation', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Internal: navigation data (GM-managed)
  // { heading, speed, fuel, eta, position, destination, shipPos, routePoints }
  game.settings.register('wy-terminal', 'navData', {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  });

  // Internal: active clearance level (per-client, persisted for GM reset)
  // Values: NONE | MEDICAL | CAPTAIN | CORPORATE | MASTER_OVERRIDE
  game.settings.register('wy-terminal', 'activeClearanceLevel', {
    scope: 'world',
    config: false,
    type: String,
    default: 'NONE',
  });

  // Internal: command codes for crew access (GM-managed)
  // Each entry: { name: 'MILLER', role: 'CAPTAIN', code: '1234' }
  game.settings.register('wy-terminal', 'commandCodes', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Internal: which ships are enabled for the Player-Terminal schematic selector
  // Stored as an array of profile ids, e.g. ['montero']. Empty = ALL ships visible.
  game.settings.register('wy-terminal', 'enabledShips', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

}
