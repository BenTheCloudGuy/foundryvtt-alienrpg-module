/**
 * MuthurBridge — Handles communication with MU/TH/UR.
 * 
 * Operates in three modes:
 * 1. ENGINE MODE (default): Uses the built-in MuthurEngine to send queries
 *    directly to OpenAI with scenario-aware prompts.
 * 2. IFRAME MODE: When a muthurUrl is configured, the MU/TH/UR view embeds
 *    the external muthurGPT web interface directly in an iframe.
 * 3. GM-RELAY MODE: When no API key or URL is configured, queries are relayed
 *    to the GM who responds manually.
 */

import { MuthurEngine } from './muthur-engine.mjs';

export class MuthurBridge {

  /** @type {import('./ship-status.mjs').ShipStatusManager} */
  shipStatus;

  /** @type {MuthurEngine|null} */
  engine = null;

  /** @type {boolean} Whether we're in GM mode */
  isGM = false;

  /** Pending response resolver (for GM relay flow) */
  _pendingResolve = null;

  /** @type {Function|null} Socket listener cleanup */
  _socketCleanup = null;

  /** @type {Function|null} Callback when engine needs to display something */
  onDisplay = null;

  /** @type {Function|null} Callback when broadcast alert arrives */
  onBroadcast = null;

  /** @type {Function|null} Callback for GM commands (crew/system/log updates) */
  onGmCommand = null;

  constructor(shipStatus) {
    this.shipStatus = shipStatus;
    this.isGM = game.user.isGM;
    this._setupSocketListener();
  }

  /**
   * Get or create the MuthurEngine instance.
   * The engine is lazily initialized on first use.
   */
  async getEngine() {
    if (!this.engine) {
      this.engine = new MuthurEngine();

      // Wire engine callbacks
      this.engine.onBroadcast = (message, sound) => {
        if (this.onBroadcast) this.onBroadcast(message, sound);
      };

      this.engine.onInjectResponse = (text) => {
        if (this.onDisplay) this.onDisplay(text, 'muthur');
      };

      this.engine.onGmCommand = (cmd) => {
        if (this.onGmCommand) this.onGmCommand(cmd);
      };

      await this.engine.initialize();
    }
    return this.engine;
  }

  /**
   * Get the active operating mode.
   */
  getMode() {
    const muthurUrl = game.settings.get('wy-terminal', 'muthurUrl');
    if (muthurUrl && !muthurUrl.includes('/api/')) return 'iframe';

    let apiKey = '';
    try { apiKey = game.settings.get('wy-terminal', 'openaiApiKey'); } catch (e) {}
    if (apiKey) return 'engine';

    if (muthurUrl && muthurUrl.includes('/api/')) return 'api';

    return 'relay';  // GM manual relay fallback
  }

  /**
   * Get header name for the active plugin.
   */
  async getHeaderName() {
    if (this.engine) return this.engine.getHeaderName();
    return 'MU/TH/UR 6000';
  }

  destroy() {
    if (this._socketCleanup) {
      this._socketCleanup();
      this._socketCleanup = null;
    }
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MESSAGING
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Send a message and get a response.
   * Dispatches to the appropriate mode.
   * @param {string} message - The user's message
   * @returns {Promise<string>} The response text
   */
  async sendMessage(message) {
    const mode = this.getMode();

    switch (mode) {
      case 'engine': {
        const engine = await this.getEngine();
        return engine.getReply(message);
      }
      case 'api':
        return this._sendToApi(game.settings.get('wy-terminal', 'muthurUrl'), message);
      case 'relay':
        return this._sendToGM(message);
      default:
        return 'INTERFACE NOT AVAILABLE IN IFRAME MODE. CHECK EMBEDDED TERMINAL.';
    }
  }

  /* ── API Mode ── */
  async _sendToApi(url, message) {
    try {
      const statusData = this.shipStatus?.getStatus() ?? {};
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          shipStatus: statusData,
          user: game.user.name,
        }),
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const data = await response.json();
      return data.reply || data.message || data.text || 'NO RESPONSE';
    } catch (err) {
      console.error('WY-Terminal | MU/TH/UR API error:', err);
      throw err;
    }
  }

  /* ── GM Relay Mode ── */
  async _sendToGM(message) {
    game.socket.emit('module.wy-terminal', {
      type: 'muthurQuery',
      payload: {
        from: game.user.name,
        message,
        timestamp: Date.now(),
      },
    });

    if (this.isGM) {
      return this._promptGMResponse(message);
    }

    return new Promise((resolve) => {
      this._pendingResolve = resolve;
      setTimeout(() => {
        if (this._pendingResolve === resolve) {
          this._pendingResolve = null;
          resolve('MU/TH/UR IS PROCESSING YOUR REQUEST. PLEASE STAND BY.');
        }
      }, 120000);
    });
  }

  /* ── GM Response Prompt ── */
  async _promptGMResponse(playerMessage) {
    return new Promise((resolve) => {
      const d = new Dialog({
        title: 'MU/TH/UR — Incoming Query',
        content: `
          <div style="font-family: monospace; background: #0a0a0a; color: #7fff00; padding: 12px; border: 1px solid #3a7a00; margin-bottom: 12px;">
            <div style="color: #555; font-size: 11px; margin-bottom: 4px;">INCOMING QUERY FROM: ${game.user.name.toUpperCase()}</div>
            <div>» ${playerMessage}</div>
          </div>
          <div>
            <label style="font-family: monospace; color: #7fff00;">MU/TH/UR RESPONSE:</label>
            <textarea id="muthur-gm-response" style="width: 100%; height: 120px; font-family: monospace; background: #0a0a0a; color: #7fff00; border: 1px solid #3a7a00; padding: 8px; text-transform: uppercase;" placeholder="TYPE MU/TH/UR'S RESPONSE..."></textarea>
          </div>
        `,
        buttons: {
          send: {
            icon: '<i class="fas fa-paper-plane"></i>',
            label: 'Transmit',
            callback: (html) => {
              const response = html.find('#muthur-gm-response').val() || 'ACKNOWLEDGED.';
              game.socket.emit('module.wy-terminal', {
                type: 'muthurResponse',
                payload: { reply: response.toUpperCase() },
              });
              resolve(response.toUpperCase());
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Ignore',
            callback: () => {
              resolve('REQUEST ACKNOWLEDGED. PROCESSING.');
            },
          },
        },
        default: 'send',
      });
      d.render(true);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SOCKET LISTENER
     ══════════════════════════════════════════════════════════════════ */

  _setupSocketListener() {
    const handler = (data) => {
      if (data.type === 'muthurResponse' && this._pendingResolve) {
        this._pendingResolve(data.payload.reply);
        this._pendingResolve = null;
      }

      if (data.type === 'muthurQuery' && this.isGM) {
        ui.notifications.info(
          `MU/TH/UR Query from ${data.payload.from}: "${data.payload.message}"`,
          { permanent: true }
        );
      }
    };

    game.socket.on('module.wy-terminal', handler);
    this._socketCleanup = () => game.socket.off('module.wy-terminal', handler);
  }

  /* ══════════════════════════════════════════════════════════════════
     GM COMMANDS — For GM users to send commands to all players
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Send a GM command to all connected clients.
   * @param {Object} command - The command object
   */
  static sendGmCommand(command) {
    MuthurEngine.sendGmCommand(command);
  }

  /**
   * Get list of available plugins.
   */
  static getAvailablePlugins() {
    return MuthurEngine.getAvailablePlugins();
  }
}
