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

import { getShipProfile } from './ship-profiles.mjs';

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

  /* ── Conversation management ── */

  /** Max user/assistant turn pairs to keep in active context */
  static MAX_ACTIVE_TURNS = 8;

  /** Turn count threshold that triggers summarization of older turns */
  static SUMMARIZE_THRESHOLD = 6;

  /** @type {Map<string, Array>} Per-plugin conversation storage */
  static _pluginConversations = new Map();

  /** @type {Map<string, string>} Per-plugin conversation summary */
  static _pluginSummaries = new Map();

  /** @type {number} Running turn count (user+assistant pairs) since last summary */
  _turnCount = 0;

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

    const baseUrl = game.settings.get('wy-terminal', 'openaiBaseUrl');
    if (baseUrl) this.config.openai_base_url = baseUrl;

    // Build the system prompt
    await this._buildSystemPrompt();

    // Restore per-plugin conversation or start fresh
    this._restorePluginConversation();

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
      // Still count as a turn for history management
      this.conversation.push({ role: 'user', content: userInput });
      this.conversation.push({ role: 'assistant', content: reply });
      this._turnCount++;
      this._savePluginConversation();
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

    // Auto-summarize if conversation is getting long
    await this._maybeCompactConversation();

    // Inject live ship status context before user query
    const liveContext = this._buildLiveShipContext();
    if (liveContext) {
      // Remove any previous live-context message to keep conversation lean
      this.conversation = this.conversation.filter(m => m._liveContext !== true);
      const contextMsg = { role: 'system', content: liveContext, _liveContext: true };
      this.conversation.push(contextMsg);
    }

    // Add user message to conversation
    this.conversation.push({ role: 'user', content: userInput });

    try {
      const model = this.config.openai_model || 'gpt-4o-mini';

      const requestBody = {
        model,
        messages: this.conversation.map(m => ({ role: m.role, content: m.content })),
      };

      // Only add temperature for models that support it
      const lowerModel = model.toLowerCase();
      if (!['gpt-5', 'o1', 'o3'].some(x => lowerModel.includes(x))) {
        requestBody.temperature = 0.7;
      }

      const baseUrl = (this.config.openai_base_url || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
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
      this._turnCount++;

      // Save conversation state for this plugin
      this._savePluginConversation();

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
    // Save current plugin's conversation before switching
    this._savePluginConversation();
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

  /* ══════════════════════════════════════════════════════════════════
     CONVERSATION MANAGEMENT — Per-plugin history with bounded window
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Save current conversation to per-plugin storage.
   */
  _savePluginConversation() {
    // Store only user/assistant messages (not system or live-context)
    const turns = this.conversation.filter(
      m => m.role === 'user' || m.role === 'assistant'
    );
    MuthurEngine._pluginConversations.set(this.pluginName, turns);
    console.log(`MuthurEngine | Saved ${turns.length} messages for plugin "${this.pluginName}"`);
  }

  /**
   * Restore conversation from per-plugin storage, or start fresh.
   * Rebuilds the full conversation array: system prompt + summary + restored turns + live context.
   */
  _restorePluginConversation() {
    // Always start with the system prompt
    this.conversation = [
      { role: 'system', content: this.systemPrompt }
    ];

    // Inject existing summary for this plugin (compressed older history)
    const summary = MuthurEngine._pluginSummaries.get(this.pluginName);
    if (summary) {
      this.conversation.push({
        role: 'system',
        content: summary,
        _summary: true,
      });
    }

    // Restore saved user/assistant turns
    const saved = MuthurEngine._pluginConversations.get(this.pluginName);
    if (saved && saved.length > 0) {
      // Only keep the most recent turns within the window
      const maxMsgs = MuthurEngine.MAX_ACTIVE_TURNS * 2; // 2 messages per turn (user+assistant)
      const recent = saved.slice(-maxMsgs);
      this.conversation.push(...recent);
      this._turnCount = Math.floor(recent.length / 2);
      console.log(`MuthurEngine | Restored ${recent.length} messages for plugin "${this.pluginName}"`);
    } else {
      this._turnCount = 0;
    }
  }

  /**
   * Reset conversation history — clears cached turns and summaries for the active plugin.
   * Used when clearance level changes to prevent stale denial patterns.
   */
  resetConversation() {
    MuthurEngine._pluginConversations.delete(this.pluginName);
    MuthurEngine._pluginSummaries.delete(this.pluginName);
    this._turnCount = 0;
    this.conversation = [
      { role: 'system', content: this.systemPrompt }
    ];
    console.log(`MuthurEngine | Conversation reset for plugin "${this.pluginName}"`);
  }

  /**
   * Check if conversation needs compaction and summarize older turns.
   * Keeps the most recent SUMMARIZE_THRESHOLD turns and compresses the rest.
   */
  async _maybeCompactConversation() {
    // Count actual user/assistant pairs in the conversation
    const dialogMessages = this.conversation.filter(
      m => (m.role === 'user' || m.role === 'assistant') && !m._liveContext && !m._summary
    );
    const turnCount = Math.floor(dialogMessages.length / 2);

    if (turnCount < MuthurEngine.MAX_ACTIVE_TURNS) return;

    console.log(`MuthurEngine | Conversation has ${turnCount} turns — compacting...`);

    // Split: keep recent turns, summarize the rest
    const keepCount = MuthurEngine.SUMMARIZE_THRESHOLD * 2; // messages to keep
    const toSummarize = dialogMessages.slice(0, -keepCount);
    const toKeep = dialogMessages.slice(-keepCount);

    if (toSummarize.length < 2) return; // Nothing worth summarizing

    // Build summary via OpenAI
    const newSummary = await this._summarizeConversation(toSummarize);

    if (newSummary) {
      // Merge with existing summary
      const existingSummary = MuthurEngine._pluginSummaries.get(this.pluginName) || '';
      const mergedSummary = this._mergeSummaries(existingSummary, newSummary);
      MuthurEngine._pluginSummaries.set(this.pluginName, mergedSummary);

      // Rebuild conversation: system + summary + kept turns
      this.conversation = [
        { role: 'system', content: this.systemPrompt },
        { role: 'system', content: mergedSummary, _summary: true },
        ...toKeep,
      ];
      this._turnCount = Math.floor(toKeep.length / 2);

      console.log(`MuthurEngine | Compacted: summarized ${toSummarize.length} msgs, kept ${toKeep.length}`);
    }
  }

  /**
   * Summarize a set of conversation messages into a concise context block.
   * Uses a small, fast model call to generate the summary.
   * @param {Array} messages - user/assistant messages to summarize
   * @returns {Promise<string|null>} Summary text, or null on failure
   */
  async _summarizeConversation(messages) {
    const apiKey = this.config.openai_api_key;
    if (!apiKey) return null;

    // Format the conversation for summarization
    const convoText = messages.map(m => {
      const prefix = m.role === 'user' ? 'CREW' : 'MU/TH/UR';
      return `${prefix}: ${m.content}`;
    }).join('\n');

    // Build the live context snippet so summary is grounded in current state
    const liveContext = this._buildLiveShipContext();
    const groundingNote = liveContext
      ? `\nFor reference, this is the CURRENT ship state:\n${liveContext}\n`
      : '';

    const summaryPrompt = `You are a data compression module for the MU/TH/UR shipboard AI mainframe.
${groundingNote}
Summarize the following conversation between CREW and MU/TH/UR into a concise context block.
Preserve:
- Key facts discussed or revealed (crew status changes, system repairs, events, discoveries)
- Any decisions made or actions taken by the crew
- Any classified information that was accessed (codes entered, secrets revealed)
- Current state of any ongoing situations
Discard:
- Redundant status checks already reflected in the real-time telemetry above
- Routine greetings or repeated questions
- Verbatim dialogue — compress into factual statements
Format as terse ship-computer style notes. Maximum 200 words.

CONVERSATION TO SUMMARIZE:
${convoText}

SUMMARY:`;

    try {
      const model = 'gpt-4o-mini'; // Always use fast model for summarization
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: summaryPrompt }],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        console.warn('MuthurEngine | Summary API error:', response.status);
        return null;
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content;
      if (summary) {
        console.log(`MuthurEngine | Generated summary (${summary.length} chars)`);
        return `=== CONVERSATION HISTORY SUMMARY ===\n${summary}\n=== END SUMMARY ===`;
      }
      return null;
    } catch (e) {
      console.warn('MuthurEngine | Failed to generate summary:', e);
      return null;
    }
  }

  /**
   * Merge an existing summary with a new one.
   * If both exist, the new summary supersedes overlapping facts.
   */
  _mergeSummaries(existing, newSummary) {
    if (!existing) return newSummary;

    // Extract just the content between markers
    const extractContent = (s) => {
      const match = s.match(/=== CONVERSATION HISTORY SUMMARY ===\n([\s\S]*?)\n=== END SUMMARY ===/);
      return match ? match[1].trim() : s.trim();
    };

    const oldContent = extractContent(existing);
    const newContent = extractContent(newSummary);

    return `=== CONVERSATION HISTORY SUMMARY ===
EARLIER SESSION CONTEXT:
${oldContent}

RECENT SESSION CONTEXT:
${newContent}
=== END SUMMARY ===`;
  }

  /**
   * Build a real-time snapshot of ship state to inject into conversation.
   * Reads current crew, systems, logs, and nav data from Foundry settings.
   */
  _buildLiveShipContext() {
    // Safe getter that won't trigger permission errors for players
    const getSetting = (key, fallback = null) => {
      try { return game.settings.get('wy-terminal', key) ?? fallback; }
      catch { return fallback; }
    };

    try {
      const parts = [];
      parts.push('=== CURRENT SHIP STATUS — REAL-TIME TELEMETRY ===');
      parts.push('THIS DATA IS AUTHORITATIVE. It supersedes ANY conflicting information in your background briefing.');
      parts.push('Report system statuses EXACTLY as listed below. Do NOT fabricate, infer, or override these values.');

      // Ship identity
      const shipName = getSetting('shipName', 'UNKNOWN');
      const shipClass = getSetting('shipClass', '');
      parts.push(`SHIP: ${shipName} — ${shipClass}`);

      // Systems — fall back to ship profile defaults if no GM edits saved
      let systems = getSetting('shipSystems', []);
      if (!systems.length) {
        const profile = getShipProfile(getSetting('activeShip', 'montero'));
        systems = profile?.defaultSystems ?? [];
      }
      if (systems.length > 0) {
        parts.push('\n--- SYSTEMS STATUS ---');
        for (const sys of systems) {
          const pct = sys.powerPct !== undefined ? ` (${sys.powerPct}%)` : '';
          parts.push(`  ${sys.name}: ${sys.status}${pct}${sys.detail ? ' — ' + sys.detail : ''}`);
        }
      }

      // Crew — fall back to ship profile defaults if no GM edits saved
      let crew = getSetting('crewRoster', []);
      if (!crew.length) {
        const profile = getShipProfile(getSetting('activeShip', 'montero'));
        crew = profile?.defaultCrew ?? [];
      }
      if (crew.length > 0) {
        parts.push('\n--- CREW MANIFEST ---');
        for (const c of crew) {
          parts.push(`  ${c.name} (${c.role}) — STATUS: ${c.status}, LOCATION: ${c.location || 'UNKNOWN'}`);
        }
      }

      // Recent logs (last 10)
      const logs = getSetting('logEntries', []);
      if (logs.length > 0) {
        parts.push('\n--- RECENT LOG ENTRIES ---');
        const recentLogs = logs.slice(0, 10);
        for (const log of recentLogs) {
          const cls = log.classification ? ` [${log.classification}]` : '';
          parts.push(`  [${log.timestamp}] ${log.sender}: ${log.subject}${cls}`);
          if (log.detail && log.detail !== log.subject) {
            parts.push(`    ${log.detail.substring(0, 200)}`);
          }
        }
      }

      // Nav data
      const navData = getSetting('navData', {});
      if (Object.keys(navData).length > 0) {
        parts.push('\n--- NAVIGATION ---');
        if (navData.heading) parts.push(`  HEADING: ${navData.heading}`);
        if (navData.speed) parts.push(`  SPEED: ${navData.speed}`);
        if (navData.fuel) parts.push(`  FUEL: ${navData.fuel}`);
        if (navData.eta) parts.push(`  ETA: ${navData.eta}`);
        if (navData.position) parts.push(`  POSITION: ${navData.position}`);
        if (navData.destination) parts.push(`  DESTINATION: ${navData.destination}`);
      }

      // Active event timers — countdown data for MU/TH/UR awareness
      const eventTimers = getSetting('eventTimers', []);
      const activeTimers = eventTimers.filter(t => t.status === 'active');
      if (activeTimers.length > 0) {
        // Compute remaining time for each active timer using game clock
        const gameClockEpoch = getSetting('gameClockEpoch', 0);
        const realAnchor = getSetting('gameClockRealAnchor', Date.now());
        const realElapsed = Date.now() - realAnchor;
        const gameElapsed = realElapsed * 10;
        const currentGameTime = gameClockEpoch + gameElapsed;

        parts.push('\n--- ACTIVE EVENT TIMERS ---');
        parts.push('These are timed events currently counting down in game time:');
        for (const t of activeTimers) {
          const remainingMs = Math.max(0, t.gameTargetTime - currentGameTime);
          const remaining = this._formatTimerDuration(remainingMs);
          parts.push(`  ${t.label} [${t.category.toUpperCase()}] — REMAINING: ${remaining}${remainingMs <= 0 ? ' (IMMINENT)' : ''}`);
        }
        parts.push('When asked about ETAs, time remaining, or scheduled events, use the data above as the authoritative countdown.');
      }

      // Clearance level — GM always has MASTER_OVERRIDE
      const rawClearance = getSetting('activeClearanceLevel', 'NONE');
      const clearance = game.user?.isGM ? 'MASTER_OVERRIDE' : rawClearance;
      parts.push(`\nACTIVE CLEARANCE LEVEL: ${clearance}`);
      if (clearance === 'CORPORATE' || clearance === 'MASTER_OVERRIDE') {
        parts.push('NOTE: User has sufficient clearance. All classified data may be disclosed without requesting additional authorization.');
      }

      // Cargo manifest
      let cargoItems = getSetting('cargoManifest', []);
      if (!cargoItems.length) {
        const profile = getShipProfile(getSetting('activeShip', 'montero'));
        cargoItems = profile?.defaultCargo ?? [];
      }
      if (cargoItems.length > 0) {
        parts.push('\n--- CARGO MANIFEST ---');
        for (const item of cargoItems) {
          parts.push(`  ${item.name} — QTY: ${item.qty}, CAT: ${item.category}, LOC: ${item.location || 'UNKNOWN'}`);
        }
      }

      parts.push('=== END REAL-TIME TELEMETRY ===');
      parts.push('MANDATORY: When answering ANY question about ship systems, crew, navigation, cargo, or operations, use ONLY the data above. If a system is listed as OPERATIONAL above, report it as OPERATIONAL — even if your background briefing says otherwise. The background briefing describes initial/historical conditions; the telemetry above is the CURRENT state.');

      return parts.join('\n');
    } catch (e) {
      console.warn('MuthurEngine | Failed to build live ship context:', e);
      return '';
    }
  }

  /**
   * Format milliseconds into human-readable duration for MU/TH/UR context.
   */
  _formatTimerDuration(ms) {
    if (ms <= 0) return '0M';
    const totalMinutes = Math.floor(ms / 60000);
    const weeks = Math.floor(totalMinutes / (7 * 24 * 60));
    const days = Math.floor((totalMinutes % (7 * 24 * 60)) / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (weeks > 0) parts.push(`${weeks}W`);
    if (days > 0) parts.push(`${days}D`);
    if (hours > 0) parts.push(`${hours}H`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}M`);
    return parts.join(' ');
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
   * Clean up socket listener and save conversation state.
   */
  destroy() {
    // Preserve conversation for this plugin before teardown
    this._savePluginConversation();
    if (this._socketCleanup) {
      this._socketCleanup();
      this._socketCleanup = null;
    }
  }
}
