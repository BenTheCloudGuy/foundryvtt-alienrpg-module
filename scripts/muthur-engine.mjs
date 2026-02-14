/**
 * MuthurEngine — Browser-compatible AI engine for the MU/TH/UR terminal.
 * 
 * Replaces the Node.js muthurGPT controller, bots, plugin_base, and config
 * with a single class that runs inside FoundryVTT's browser environment.
 * 
 * Handles:
 *  - Loading plugin configs and prompts from static assets
 *  - Building system prompts with prompt_updates / dynamic context
 *  - Sending messages to OpenAI via fetch()
 *  - GM command processing via Foundry sockets
 *  - Conversation history management
 */

const MODULE_PATH = 'modules/wy-terminal';
const MUTHUR_PATH = `${MODULE_PATH}/muthur`;

/**
 * Available plugin definitions.
 * Each plugin has a name and the paths to its assets relative to the module.
 */
const PLUGIN_REGISTRY = {
  montero: {
    name: 'montero',
    label: 'USCSS Montero',
    headerName: 'MU/TH/UR 6500',
  },
  cronus: {
    name: 'cronus',
    label: 'USCSS Cronus',
    headerName: 'MU/TH/UR 2000',
  },
  cronus_life_support: {
    name: 'cronus_life_support',
    label: 'USCSS Cronus (Life Support)',
    headerName: 'MU/TH/UR 2000',
  },
  fort_nebraska: {
    name: 'fort_nebraska',
    label: 'Fort Nebraska',
    headerName: 'A.P.O.L.L.O.',
  },
};

export class MuthurEngine {

  /** @type {string} Active plugin name */
  pluginName = 'cronus';

  /** @type {Object} Merged config (base + plugin) */
  config = {};

  /** @type {string} The full system prompt sent to OpenAI */
  systemPrompt = '';

  /** @type {Array<{role: string, content: string}>} Conversation history */
  conversation = [];

  /** @type {string|null} GM-injected response for next query */
  injectedResponse = null;

  /** @type {string} Dynamic prompt context from GM commands */
  dynamicPrompt = '';

  /** @type {Array} Active conditions from GM */
  activeConditions = [];

  /** @type {boolean} Whether engine is initialized */
  _initialized = false;

  /** @type {Function|null} Socket listener cleanup */
  _socketCleanup = null;

  /** @type {Function|null} Callback when GM command arrives */
  onGmCommand = null;

  /** @type {Function|null} Callback when broadcast arrives */
  onBroadcast = null;

  /** @type {Function|null} Callback when injected response is set */
  onInjectResponse = null;

  constructor() {}

  /* ══════════════════════════════════════════════════════════════════
     INITIALIZATION
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Initialize the engine with the active plugin.
   * Loads configs, prompts, and sets up the conversation.
   */
  async initialize(pluginName = null) {
    this.pluginName = pluginName || game.settings.get('wy-terminal', 'muthurPlugin') || 'cronus';

    // Load base config
    try {
      const baseResp = await fetch(`${MUTHUR_PATH}/config.json`);
      this.config = await baseResp.json();
    } catch (e) {
      console.error('MuthurEngine | Failed to load base config:', e);
      this.config = {};
    }

    // Load plugin config (merges over base)
    try {
      const pluginResp = await fetch(`${MUTHUR_PATH}/plugins/${this.pluginName}/config.json`);
      const pluginConfig = await pluginResp.json();
      Object.assign(this.config, pluginConfig);
    } catch (e) {
      console.warn(`MuthurEngine | No plugin config for "${this.pluginName}":`, e);
    }

    // Override with Foundry settings
    const apiKey = game.settings.get('wy-terminal', 'openaiApiKey');
    if (apiKey) this.config.openai_api_key = apiKey;

    const model = game.settings.get('wy-terminal', 'openaiModel');
    if (model) this.config.openai_model = model;

    // Build the system prompt
    await this._buildSystemPrompt();

    // Reset conversation
    this.conversation = [
      { role: 'system', content: this.systemPrompt }
    ];

    // Setup socket listener for GM commands
    this._setupSocketListener();

    this._initialized = true;
    console.log(`MuthurEngine | Initialized with plugin "${this.pluginName}"`);
    return this;
  }

  /**
   * Build the full system prompt from prefix + plugin prompt + suffix + prompt_updates.
   */
  async _buildSystemPrompt() {
    let prompt = '';

    // Load shared prefix
    try {
      const resp = await fetch(`${MUTHUR_PATH}/prompts/prompt_prefix.txt`);
      prompt += await resp.text();
    } catch (e) {
      console.warn('MuthurEngine | Could not load prompt_prefix.txt');
    }

    // Load plugin-specific prompt
    try {
      const resp = await fetch(`${MUTHUR_PATH}/plugins/${this.pluginName}/prompts/${this.pluginName}_prompt.txt`);
      prompt += '\n' + await resp.text();
    } catch (e) {
      console.warn(`MuthurEngine | Could not load ${this.pluginName}_prompt.txt`);
    }

    // Apply prompt_updates from config (conditional story beats)
    const promptUpdates = this.config.prompt_updates || {};
    for (const [flagName, updateText] of Object.entries(promptUpdates)) {
      if (this.config[flagName]) {
        prompt += '\n' + updateText;
      }
    }

    // Load shared suffix
    try {
      const resp = await fetch(`${MUTHUR_PATH}/prompts/prompt_suffix.txt`);
      prompt += '\n' + await resp.text();
    } catch (e) {
      console.warn('MuthurEngine | Could not load prompt_suffix.txt');
    }

    // Append dynamic prompt from GM
    if (this.dynamicPrompt) {
      prompt += '\n' + this.dynamicPrompt;
    }

    this.systemPrompt = prompt;
  }

  /* ══════════════════════════════════════════════════════════════════
     MESSAGING
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Send a message and get an AI response.
   * @param {string} userInput
   * @returns {Promise<string>} The bot reply
   */
  async getReply(userInput) {
    // Check for injected GM response
    if (this.injectedResponse) {
      const reply = this.injectedResponse;
      this.injectedResponse = null;
      return reply;
    }

    // Force uppercase if configured
    if (this.config.force_upper_case) {
      userInput = userInput.toUpperCase();
    }

    const apiKey = this.config.openai_api_key;
    if (!apiKey) {
      return 'ERROR: NO API KEY CONFIGURED.\nSET OPENAI API KEY IN MODULE SETTINGS.';
    }

    // Add user message to conversation
    this.conversation.push({ role: 'user', content: userInput });

    try {
      const model = this.config.openai_model || 'gpt-4o-mini';

      const requestBody = {
        model,
        messages: this.conversation,
      };

      // Only add temperature for models that support it
      const lowerModel = model.toLowerCase();
      if (!['gpt-5', 'o1', 'o3'].some(x => lowerModel.includes(x))) {
        requestBody.temperature = 0.7;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const botReply = data.choices?.[0]?.message?.content || 'NO RESPONSE';

      // Add assistant reply to conversation
      this.conversation.push({ role: 'assistant', content: botReply });

      // Apply uppercase filter
      return this.config.force_upper_case ? botReply.toUpperCase() : botReply;

    } catch (err) {
      console.error('MuthurEngine | OpenAI error:', err);
      // Remove the failed user message
      this.conversation.pop();
      return `SYSTEM ERROR: ${err.message}`;
    }
  }

  /**
   * Get the generic greeting/idle message.
   */
  getGenericMessage() {
    return this.config.generic_bot_message || 'INTERFACE ACTIVE.\nENTER QUERY.';
  }

  /**
   * Get the header name for the current plugin.
   */
  getHeaderName() {
    return this.config.header_name || PLUGIN_REGISTRY[this.pluginName]?.headerName || 'MU/TH/UR';
  }

  /* ══════════════════════════════════════════════════════════════════
     PLUGIN MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Switch to a different plugin.
   */
  async switchPlugin(newPluginName) {
    if (!PLUGIN_REGISTRY[newPluginName]) {
      throw new Error(`Unknown plugin: ${newPluginName}`);
    }
    this.pluginName = newPluginName;
    this.dynamicPrompt = '';
    this.activeConditions = [];
    this.injectedResponse = null;
    await this.initialize(newPluginName);
  }

  /**
   * Get list of available plugins.
   */
  static getAvailablePlugins() {
    return Object.entries(PLUGIN_REGISTRY).map(([key, val]) => ({
      id: key,
      label: val.label,
      headerName: val.headerName,
    }));
  }

  /* ══════════════════════════════════════════════════════════════════
     GM COMMAND PROCESSING (via Foundry sockets)
     ══════════════════════════════════════════════════════════════════ */

  _setupSocketListener() {
    // Clean up any existing listener
    if (this._socketCleanup) {
      this._socketCleanup();
    }

    const handler = (data) => {
      if (data.type === 'gmCommand') {
        this._processGmCommand(data.payload);
      }
    };

    game.socket.on('module.wy-terminal', handler);
    this._socketCleanup = () => game.socket.off('module.wy-terminal', handler);
  }

  /**
   * Process a single GM command.
   */
  async _processGmCommand(cmd) {
    const cmdType = cmd.type || '';

    switch (cmdType) {
      case 'broadcast':
        if (this.onBroadcast) {
          this.onBroadcast(cmd.message || 'ALERT', cmd.sound);
        }
        break;

      case 'inject_response':
        this.injectedResponse = cmd.message || '';
        if (this.onInjectResponse) {
          this.onInjectResponse(this.injectedResponse);
        }
        break;

      case 'play_sound':
        this._playSound(cmd.sound);
        break;

      case 'clear_screen':
        if (this.onGmCommand) {
          this.onGmCommand({ type: 'clear_screen' });
        }
        break;

      case 'update_flag':
      case 'set_flag': {
        const flag = cmd.flag || '';
        if (flag) {
          if (cmdType === 'update_flag') {
            this.config[flag] = !this.config[flag];
          } else {
            this.config[flag] = cmd.value !== undefined ? cmd.value : true;
          }
          await this._rebuildPrompt();
        }
        break;
      }

      case 'add_prompt_context': {
        const context = cmd.context || '';
        const alertType = cmd.alert_type || 'unknown';
        const location = cmd.location || '';
        if (context) {
          this.activeConditions = this.activeConditions.filter(
            c => !(c.type === alertType && c.location === location)
          );
          this.activeConditions.push({ type: alertType, location, context });
          this._updateDynamicPrompt();
          await this._rebuildPrompt();
        }
        break;
      }

      case 'clear_condition': {
        const alertType = cmd.alert_type || '';
        const location = cmd.location || '';
        if (alertType) {
          this.activeConditions = this.activeConditions.filter(
            c => !(c.type === alertType && (!location || c.location === location))
          );
          this._updateDynamicPrompt();
          await this._rebuildPrompt();
        }
        break;
      }

      case 'switch_plugin':
        if (cmd.plugin) {
          try {
            await this.switchPlugin(cmd.plugin);
            if (this.onGmCommand) {
              this.onGmCommand({ type: 'plugin_switched', plugin: cmd.plugin });
            }
          } catch (e) {
            console.error('MuthurEngine | Plugin switch failed:', e);
          }
        }
        break;

      case 'update_crew_location':
      case 'assign_crew_task':
      case 'update_crew_status':
      case 'complete_crew_task':
      case 'update_ship_system':
      case 'add_log_entry':
      case 'set_game_time':
        // Forward crew/system/log commands to the ship status manager
        if (this.onGmCommand) {
          this.onGmCommand(cmd);
        }
        break;

      case 'start_self_destruct':
        if (this.onGmCommand) {
          this.onGmCommand({ type: 'start_self_destruct' });
        }
        break;

      case 'cancel_self_destruct':
        if (this.onGmCommand) {
          this.onGmCommand({ type: 'cancel_self_destruct' });
        }
        break;

      default:
        console.warn(`MuthurEngine | Unknown GM command type: ${cmdType}`);
    }
  }

  /**
   * Send a GM command to all clients (GM-only).
   */
  static sendGmCommand(command) {
    if (!game.user.isGM) {
      console.warn('MuthurEngine | Only GM can send commands');
      return;
    }
    game.socket.emit('module.wy-terminal', {
      type: 'gmCommand',
      payload: command,
    });
    // Also process locally for the GM's own terminal
    // (handled by the socket listener)
  }

  _updateDynamicPrompt() {
    if (this.activeConditions.length === 0) {
      this.dynamicPrompt = '';
      return;
    }
    let prompt = '\n=== ACTIVE SHIP CONDITIONS ===\n';
    for (const condition of this.activeConditions) {
      prompt += `- [${condition.type.toUpperCase()}]`;
      if (condition.location) prompt += ` at ${condition.location}`;
      prompt += `: ${condition.context}\n`;
    }
    this.dynamicPrompt = prompt;
  }

  async _rebuildPrompt() {
    await this._buildSystemPrompt();
    // Update the system message in conversation
    if (this.conversation.length > 0) {
      this.conversation[0] = { role: 'system', content: this.systemPrompt };
    }
  }

  _playSound(soundName) {
    if (!soundName) return;
    const cleanName = soundName.replace('.wav', '');
    const soundPath = `${MUTHUR_PATH}/sounds/${cleanName}.wav`;

    try {
      const soundEnabled = game.settings.get('wy-terminal', 'soundEnabled');
      if (!soundEnabled) return;

      // Use Foundry's audio system
      AudioHelper.play({ src: soundPath, volume: 0.5, autoplay: true, loop: false }, false);
    } catch (e) {
      console.warn(`MuthurEngine | Could not play sound "${cleanName}":`, e);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Get current ship systems status.
   */
  getShipSystems() {
    return this.config.ship_systems || {};
  }

  /**
   * Get crew roster.
   */
  getCrew() {
    return this.config.crew || [];
  }

  /**
   * Get ship locations.
   */
  getShipLocations() {
    return this.config.ship_locations || [];
  }

  /**
   * Get prompt update flags and their current state.
   */
  getPromptFlags() {
    const promptUpdates = this.config.prompt_updates || {};
    return Object.entries(promptUpdates).map(([flag, text]) => ({
      flag,
      text: text.substring(0, 80) + (text.length > 80 ? '...' : ''),
      active: !!this.config[flag],
    }));
  }

  /**
   * Clean up socket listener.
   */
  destroy() {
    if (this._socketCleanup) {
      this._socketCleanup();
      this._socketCleanup = null;
    }
  }
}
