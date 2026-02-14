/**
 * Module Settings Registration
 */

export function registerSettings() {
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

  // Internal: persisted chat history
  game.settings.register('wy-terminal', 'chatHistory', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
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
}
