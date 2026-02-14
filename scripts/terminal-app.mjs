/**
 * WYTerminalApp — The main Foundry Application window for the Weyland-Yutani Terminal.
 * Manages all terminal views, navigation, display frame with pinch-zoom,
 * scene rendering, and MU/TH/UR chat integration.
 */

import { PinchZoomHandler } from './pinch-zoom.mjs';
import { MuthurBridge } from './muthur-bridge.mjs';
import { MuthurEngine } from './muthur-engine.mjs';

export class WYTerminalApp extends Application {

  /** @type {import('./ship-status.mjs').ShipStatusManager} */
  shipStatus;

  /** @type {string} Current active view name */
  activeView = 'boot';

  /** @type {PinchZoomHandler|null} */
  zoomHandler = null;

  /** @type {MuthurBridge|null} */
  muthurBridge = null;

  /** @type {Array<{type: string, text: string}>} */
  chatHistory = [];

  /** @type {string|null} Active alert message */
  alertMessage = null;

  /** @type {string|null} Currently selected scene ID */
  activeSceneId = null;

  /** @type {string|null} Currently selected map ID */
  activeMapId = null;

  constructor(options = {}) {
    super(options);
    this.shipStatus = options.shipStatus;

    // Load persisted chat history
    try {
      const saved = game.settings.get('wy-terminal', 'chatHistory');
      if (Array.isArray(saved)) this.chatHistory = saved;
    } catch (e) { /* first load */ }
  }

  static get defaultOptions() {
    const w = 1200;
    const h = 800;
    try {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: 'wy-terminal',
        title: 'W-Y Terminal',
        template: 'modules/wy-terminal/templates/terminal.hbs',
        width: game.settings.get('wy-terminal', 'terminalWidth') || w,
        height: game.settings.get('wy-terminal', 'terminalHeight') || h,
        classes: ['wy-terminal-app'],
        resizable: true,
        popOut: true,
      });
    } catch {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: 'wy-terminal',
        title: 'W-Y Terminal',
        template: 'modules/wy-terminal/templates/terminal.hbs',
        width: w,
        height: h,
        classes: ['wy-terminal-app'],
        resizable: true,
        popOut: true,
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DATA
     ══════════════════════════════════════════════════════════════════ */

  getData() {
    const shipName = game.settings.get('wy-terminal', 'shipName');
    const shipClass = game.settings.get('wy-terminal', 'shipClass');
    const scanlines = game.settings.get('wy-terminal', 'scanlines');
    const crtFlicker = game.settings.get('wy-terminal', 'crtFlicker');
    const status = this.shipStatus?.getStatus() ?? {};

    const systemStatus = status.alert ? 'WARNING' : 'NOMINAL';
    const systemStatusClass = status.alert ? 'warning' : 'online';

    return {
      shipName,
      shipClass,
      shipRegistry: game.settings.get('wy-terminal', 'shipRegistry'),
      scanlines,
      crtFlicker,
      systemStatus,
      systemStatusClass,
      activeView: this.activeView,
      currentDate: this._getGameDate(),
      alertActive: !!this.alertMessage,
      alertMessage: this.alertMessage || '',
      displayTitle: this._getDisplayTitle(),
      userName: game.user.name.toUpperCase(),
      muthurOnline: this._isMuthurAvailable(),
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER & LIFECYCLE
     ══════════════════════════════════════════════════════════════════ */

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;

    // Navigation buttons
    el.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this._switchView(view);
      });
      // Touch support
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        const view = e.currentTarget.dataset.view;
        this._switchView(view);
      });
    });

    // Close button
    el.querySelector('[data-action="close-terminal"]')?.addEventListener('click', () => this.close());

    // Zoom buttons
    el.querySelector('[data-action="zoom-in"]')?.addEventListener('click', () => this.zoomHandler?.zoomIn());
    el.querySelector('[data-action="zoom-out"]')?.addEventListener('click', () => this.zoomHandler?.zoomOut());
    el.querySelector('[data-action="zoom-reset"]')?.addEventListener('click', () => this.zoomHandler?.reset());

    // Initialize pinch-zoom on the display frame
    const displayFrame = el.querySelector('#wy-display-frame');
    const displayContent = el.querySelector('#wy-display-content');
    if (displayFrame && displayContent) {
      this.zoomHandler = new PinchZoomHandler(displayFrame, displayContent);
    }

    // Render initial view
    this._renderView(this.activeView);
  }

  close(options) {
    // Cleanup
    if (this.zoomHandler) {
      this.zoomHandler.destroy();
      this.zoomHandler = null;
    }
    if (this.muthurBridge) {
      this.muthurBridge.destroy();
      this.muthurBridge = null;
    }
    return super.close(options);
  }

  /* ══════════════════════════════════════════════════════════════════
     VIEW MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Switch to a different terminal view.
   * @param {string} viewName
   */
  _switchView(viewName) {
    this.activeView = viewName;

    // Update button active states
    const el = this.element[0] ?? this.element;
    el.querySelectorAll('[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update display title
    const titleEl = el.querySelector('#wy-display-title');
    if (titleEl) titleEl.textContent = this._getDisplayTitle();

    // Reset zoom for some views
    if (['muthur', 'settings', 'boot'].includes(viewName)) {
      this.zoomHandler?.reset();
    }

    this._renderView(viewName);
  }

  /**
   * Render a specific view into the display frame.
   * @param {string} viewName
   */
  async _renderView(viewName) {
    const contentEl = this.element[0]?.querySelector('#wy-display-content')
      ?? this.element?.find?.('#wy-display-content')?.[0];
    if (!contentEl) return;

    const templatePath = `modules/wy-terminal/templates/views/${viewName}.hbs`;
    const data = this._getViewData(viewName);

    try {
      const rendered = await renderTemplate(templatePath, data);
      contentEl.innerHTML = rendered;

      // Post-render hooks per view
      this._onViewRendered(viewName, contentEl);
    } catch (err) {
      console.error(`WY-Terminal | Failed to render view "${viewName}":`, err);
      contentEl.innerHTML = `<div style="padding: 20px; color: var(--wy-red); letter-spacing: 2px;">ERROR: VIEW "${viewName.toUpperCase()}" NOT FOUND</div>`;
    }
  }

  /**
   * Refresh current view without changing it.
   */
  refreshCurrentView() {
    this._renderView(this.activeView);
  }

  /**
   * Show an alert in the alert bar.
   * @param {string} message
   * @param {number} duration - Duration in ms (0 = persistent)
   */
  showAlert(message, duration = 10000) {
    this.alertMessage = message;
    const el = this.element[0] ?? this.element;
    const bar = el?.querySelector('.wy-alert-bar');
    if (bar) {
      bar.textContent = `⚠ ${message} ⚠`;
      bar.classList.add('active');
    }
    if (duration > 0) {
      setTimeout(() => this.hideAlert(), duration);
    }
  }

  hideAlert() {
    this.alertMessage = null;
    const el = this.element[0] ?? this.element;
    const bar = el?.querySelector('.wy-alert-bar');
    if (bar) bar.classList.remove('active');
  }

  /* ══════════════════════════════════════════════════════════════════
     VIEW DATA PROVIDERS
     ══════════════════════════════════════════════════════════════════ */

  _getViewData(viewName) {
    const base = {
      shipName: game.settings.get('wy-terminal', 'shipName'),
      shipClass: game.settings.get('wy-terminal', 'shipClass'),
      shipRegistry: game.settings.get('wy-terminal', 'shipRegistry'),
      missionName: game.settings.get('wy-terminal', 'missionName'),
      currentDate: this._getGameDate(),
    };

    switch (viewName) {
      case 'boot':
        return { ...base, systemStatus: 'NOMINAL' };

      case 'status':
        return { ...base, systems: this._getSystemsData() };

      case 'crew':
        return { ...base, crew: this._getCrewData(), activeTasks: this._getActiveTasksData() };

      case 'systems':
        return { ...base, systems: this._getSystemsDetailData() };

      case 'logs':
        return { ...base, logs: this._getLogData() };

      case 'muthur':
        return { ...base, chatHistory: this.chatHistory, muthurHeader: this._getMuthurHeader() };

      case 'scenes':
        return { ...base, ...this._getScenesData() };

      case 'maps':
        return { ...base, ...this._getMapsData() };

      case 'emergency':
        return { ...base, ...this._getEmergencyData() };

      case 'nav':
        return { ...base, ...this._getNavData() };

      case 'comms':
        return { ...base, ...this._getCommsData() };

      case 'cargo':
        return { ...base, cargoItems: this._getCargoData() };

      case 'settings':
        return {
          ...base,
          muthurUrl: game.settings.get('wy-terminal', 'muthurUrl'),
          statusPath: game.settings.get('wy-terminal', 'statusPath'),
          scanlines: game.settings.get('wy-terminal', 'scanlines'),
          crtFlicker: game.settings.get('wy-terminal', 'crtFlicker'),
          soundEnabled: game.settings.get('wy-terminal', 'soundEnabled'),
          openaiApiKey: game.settings.get('wy-terminal', 'openaiApiKey') ? '••••••••' : '',
          openaiModel: game.settings.get('wy-terminal', 'openaiModel'),
          muthurPlugin: game.settings.get('wy-terminal', 'muthurPlugin'),
          availablePlugins: MuthurEngine.getAvailablePlugins(),
          isGM: game.user.isGM,
        };

      default:
        return base;
    }
  }

  /* ── System data ── */
  _getSystemsData() {
    const systems = this._loadSetting('shipSystems');
    if (systems.length) return systems;

    // Default systems for Chariots of the Gods / Montero
    return [
      { name: 'REACTOR', status: 'ONLINE', statusClass: 'online', detail: 'PWR OUTPUT NOMINAL' },
      { name: 'LIFE SUPPORT', status: 'ONLINE', statusClass: 'online', detail: 'O2/CO2 NOMINAL' },
      { name: 'ENGINES', status: 'ONLINE', statusClass: 'online', detail: 'FEL DRIVE STANDBY' },
      { name: 'COMMS ARRAY', status: 'ONLINE', statusClass: 'online', detail: 'FREQ: STANDARD' },
      { name: 'SENSORS', status: 'ONLINE', statusClass: 'online', detail: 'RANGE: 100 AU' },
      { name: 'HULL INTEGRITY', status: 'NOMINAL', statusClass: 'online', detail: '100%' },
      { name: 'WEAPONS', status: 'N/A', statusClass: 'offline', detail: 'NOT INSTALLED' },
      { name: 'MU/TH/UR UPLINK', status: 'ONLINE', statusClass: 'online', detail: '6000 SERIES' },
    ];
  }

  _getSystemsDetailData() {
    const systems = this._getSystemsData();
    return systems.map(s => ({
      ...s,
      power: s.status === 'ONLINE' || s.status === 'NOMINAL' ? 'ACTIVE' : 'REDUCED',
      notes: s.detail,
      statusTextClass: s.statusClass === 'online' ? 'wy-text-green' :
        s.statusClass === 'warning' ? 'wy-text-amber' :
          s.statusClass === 'critical' ? 'wy-text-red' : 'wy-text-dim',
      powerPct: s.status === 'ONLINE' || s.status === 'NOMINAL' ? 100 :
        s.status === 'WARNING' ? 60 : s.status === 'OFFLINE' ? 0 : 30,
      powerColor: s.statusClass === 'online' ? 'var(--wy-green)' :
        s.statusClass === 'warning' ? 'var(--wy-amber)' : 'var(--wy-red)',
    }));
  }

  /* ── Crew data ── */
  _getCrewData() {
    const crew = this._loadSetting('crewRoster');
    if (crew.length) return crew;

    // Default Montero crew
    return [
      { name: 'MILLER', role: 'CAPTAIN', location: 'BRIDGE', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'CHAM', role: 'PILOT', location: 'BRIDGE', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'RYLE', role: 'ROUGHNECK', location: 'CREW QUARTERS', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'WILSON', role: 'MEDIC', location: 'MEDBAY', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'REID', role: 'COMPANY AGENT', location: 'CARGO BAY', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'DAVIS', role: 'ROUGHNECK', location: 'ENGINE ROOM', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
      { name: 'LUCAS', role: 'COMPANY REP', location: 'LOUNGE', status: 'ACTIVE', statusClass: 'online', statusTextClass: 'wy-text-green' },
    ];
  }

  _getActiveTasksData() {
    // Could be populated from ship status
    const status = this.shipStatus?.getStatus() ?? {};
    return status.activeTasks || [];
  }

  /* ── Log data ── */
  _getLogData() {
    const logs = this._loadSetting('logEntries');
    if (logs.length) return logs;

    return [
      { timestamp: '2183-06-12 06:00:00', source: 'SYSTEM', message: 'CREW REVIVED FROM CRYOSLEEP', level: '' },
      { timestamp: '2183-06-12 06:05:00', source: 'MU/TH/UR', message: 'UNKNOWN SIGNAL DETECTED ON LONG-RANGE SENSORS', level: 'warning' },
      { timestamp: '2183-06-12 06:10:00', source: 'NAV', message: 'COURSE CORRECTION CALCULATED FOR SIGNAL SOURCE', level: '' },
    ];
  }

  /* ── Scenes data ── */
  _getScenesData() {
    const scenes = game.scenes?.contents?.map(s => ({
      id: s.id,
      name: s.name.toUpperCase(),
      active: s.id === this.activeSceneId,
    })) ?? [];

    let activeSceneImg = null;
    let activeSceneName = null;
    let tokens = [];

    if (this.activeSceneId) {
      const scene = game.scenes.get(this.activeSceneId);
      if (scene) {
        activeSceneImg = scene.background?.src || scene.img;
        activeSceneName = scene.name;

        // Extract token data for the selected scene
        tokens = this._getSceneTokens(scene);
      }
    }

    return { scenes, activeSceneImg, activeSceneName, tokens };
  }

  /**
   * Extract token positions/data from a Foundry scene for terminal overlay.
   * Token positions are converted to percentages relative to scene dimensions.
   */
  _getSceneTokens(scene) {
    if (!scene?.tokens?.contents) return [];

    const sceneWidth = scene.width || 1;
    const sceneHeight = scene.height || 1;

    return scene.tokens.contents.map(t => {
      // Convert pixel position to percentage of scene dimensions
      const xPct = ((t.x || 0) / sceneWidth) * 100;
      const yPct = ((t.y || 0) / sceneHeight) * 100;

      // Determine disposition class
      let disposition = 'neutral';
      const disp = t.disposition ?? t.document?.disposition;
      if (disp === 1) disposition = 'friendly';      // FRIENDLY
      else if (disp === 0) disposition = 'neutral';   // NEUTRAL
      else if (disp === -1) disposition = 'hostile';   // HOSTILE
      else if (disp === -2) disposition = 'secret';    // SECRET

      // Token image
      const img = t.texture?.src || t.img || null;

      // Token size (grid-relative)
      const gridSize = scene.grid?.size || scene.data?.grid || 100;
      const tokenWidth = (t.width || 1) * gridSize;
      const displaySize = Math.max(24, Math.min(64, tokenWidth * 0.5));

      return {
        id: t.id,
        name: (t.name || 'UNKNOWN').toUpperCase(),
        actor: (t.actor?.name || t.actorId || '').toUpperCase(),
        x: xPct.toFixed(2),
        y: yPct.toFixed(2),
        size: displaySize,
        img,
        icon: disposition === 'hostile' ? '▲' : disposition === 'friendly' ? '◆' : '●',
        disposition,
        hidden: t.hidden || false,
      };
    }).filter(t => !t.hidden); // Don't show hidden tokens to players
  }

  /* ── Maps data ── */
  _getMapsData() {
    const maps = this._loadSetting('maps');
    let activeMapImg = null;
    let activeMapName = null;

    if (this.activeMapId) {
      const map = maps.find(m => m.id === this.activeMapId);
      if (map) {
        activeMapImg = map.img;
        activeMapName = map.name;
      }
    }

    return {
      maps: maps.map(m => ({ ...m, active: m.id === this.activeMapId })),
      activeMapImg,
      activeMapName,
    };
  }

  /* ── Emergency data ── */
  _getEmergencyData() {
    const status = this.shipStatus?.getStatus() ?? {};
    return {
      selfDestructActive: !!status.selfDestructActive,
      selfDestructTimer: status.selfDestructTimer || '00:00:00',
    };
  }

  /* ── Nav data ── */
  _getNavData() {
    const status = this.shipStatus?.getStatus() ?? {};
    return {
      currentPosition: status.currentPosition || 'SECTOR 87-C / ZETA RETICULI',
      destination: status.destination || 'NOT SET',
      eta: status.eta || 'N/A',
      speed: status.speed || 'STATION KEEPING',
      fuelLevel: status.fuelLevel || '87%',
      fuelClass: 'wy-text-green',
      navPoints: status.navPoints || [],
    };
  }

  /* ── Comms data ── */
  _getCommsData() {
    const status = this.shipStatus?.getStatus() ?? {};
    return {
      commStatus: status.commStatus || 'ONLINE',
      commStatusClass: status.commStatusClass || 'online',
      commFrequency: status.commFrequency || '475.12 MHz',
      commRange: status.commRange || '100 AU',
      messages: status.messages || [],
    };
  }

  /* ── Cargo data ── */
  _getCargoData() {
    const status = this.shipStatus?.getStatus() ?? {};
    return status.cargoItems || [
      { name: 'REFINED TRITIUM ORE', quantity: 2000, unit: 'TONS' },
      { name: 'MEDICAL SUPPLIES', quantity: 50, unit: 'CRATES' },
      { name: 'WATER RESERVES', quantity: 500, unit: 'KL' },
    ];
  }

  /* ══════════════════════════════════════════════════════════════════
     POST-RENDER HOOKS — Wire up view-specific interactions
     ══════════════════════════════════════════════════════════════════ */

  _onViewRendered(viewName, contentEl) {
    switch (viewName) {
      case 'muthur':
        this._setupMuthurView(contentEl);
        break;
      case 'scenes':
        this._setupScenesView(contentEl);
        break;
      case 'maps':
        this._setupMapsView(contentEl);
        break;
      case 'emergency':
        this._setupEmergencyView(contentEl);
        break;
      case 'settings':
        this._setupSettingsView(contentEl);
        break;
    }
  }

  /* ── MU/TH/UR Chat Setup ── */
  _setupMuthurView(contentEl) {
    const mode = this.muthurBridge?.getMode() ?? 'relay';

    // IFRAME mode: embed external URL
    const muthurUrl = game.settings.get('wy-terminal', 'muthurUrl');
    if (mode === 'iframe' && muthurUrl) {
      this._embedMuthurIframe(contentEl, muthurUrl);
      return;
    }

    // Ensure bridge is created and callbacks are wired
    this._ensureMuthurBridge();

    // Built-in chat / engine mode
    const input = contentEl.querySelector('#wy-muthur-input');
    const sendBtn = contentEl.querySelector('[data-action="muthur-send"]');
    const output = contentEl.querySelector('#wy-muthur-output');

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._sendMuthurMessage(input.value);
          input.value = '';
        }
      });
      // Focus on render
      setTimeout(() => input.focus(), 100);
    }

    sendBtn?.addEventListener('click', () => {
      if (input?.value) {
        this._sendMuthurMessage(input.value);
        input.value = '';
      }
    });

    // Auto-scroll to bottom
    if (output) {
      output.scrollTop = output.scrollHeight;
    }
  }

  _embedMuthurIframe(contentEl, url) {
    contentEl.innerHTML = `
      <div class="wy-iframe-container">
        <iframe src="${url}" 
                allow="microphone; autoplay" 
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title="MU/TH/UR AI Interface"></iframe>
      </div>
    `;
  }

  /**
   * Ensure the MuthurBridge is created and its callbacks are wired.
   */
  _ensureMuthurBridge() {
    if (this.muthurBridge) return;
    this.muthurBridge = new MuthurBridge(this.shipStatus);

    // Wire callbacks
    this.muthurBridge.onBroadcast = (message, sound) => {
      this.showAlert(message);
    };

    this.muthurBridge.onDisplay = (text, type) => {
      // Injected response from GM — display immediately
      this.chatHistory.push({ type: type || 'muthur', text });
      this._persistChatHistory();
      if (this.activeView === 'muthur') this._renderView('muthur');
    };

    this.muthurBridge.onGmCommand = (cmd) => {
      this._handleEngineGmCommand(cmd);
    };
  }

  /**
   * Check if MU/TH/UR AI is available (has API key or URL configured).
   */
  _isMuthurAvailable() {
    try {
      const url = game.settings.get('wy-terminal', 'muthurUrl');
      if (url) return true;
      const key = game.settings.get('wy-terminal', 'openaiApiKey');
      if (key) return true;
    } catch (e) {}
    return true;  // Always show — relay mode is always available
  }

  async _sendMuthurMessage(text) {
    if (!text.trim()) return;

    const userMsg = text.trim().toUpperCase();
    this.chatHistory.push({ type: 'user', text: userMsg });

    // Ensure bridge exists
    this._ensureMuthurBridge();

    // Show user message + thinking indicator
    this.chatHistory.push({ type: 'system', text: 'PROCESSING QUERY...' });
    this._renderView('muthur');

    try {
      const reply = await this.muthurBridge.sendMessage(userMsg);
      // Remove the "PROCESSING" placeholder
      this.chatHistory = this.chatHistory.filter(m => m.text !== 'PROCESSING QUERY...');
      this.chatHistory.push({ type: 'muthur', text: reply });
    } catch (err) {
      this.chatHistory = this.chatHistory.filter(m => m.text !== 'PROCESSING QUERY...');
      this.chatHistory.push({
        type: 'system',
        text: 'ERROR: UNABLE TO REACH MU/TH/UR. COMMUNICATIONS FAILURE.'
      });
      console.error('WY-Terminal | MU/TH/UR communication error:', err);
    }

    await this._persistChatHistory();
    this._renderView('muthur');
  }

  /**
   * Persist chat history to Foundry settings.
   */
  async _persistChatHistory() {
    try {
      await game.settings.set('wy-terminal', 'chatHistory', this.chatHistory);
    } catch (e) { /* non-critical */ }
  }

  /**
   * Handle a GM command forwarded from the MuthurEngine.
   */
  _handleEngineGmCommand(cmd) {
    switch (cmd.type) {
      case 'clear_screen':
        this.chatHistory = [];
        this._persistChatHistory();
        if (this.activeView === 'muthur') this._renderView('muthur');
        break;

      case 'plugin_switched':
        this.chatHistory.push({
          type: 'system',
          text: `SCENARIO SWITCHED TO: ${cmd.plugin?.toUpperCase() || 'UNKNOWN'}`
        });
        this._persistChatHistory();
        if (this.activeView === 'muthur') this._renderView('muthur');
        break;

      case 'start_self_destruct':
        this.shipStatus?.update({ selfDestructActive: true, selfDestructTimer: '10:00:00' });
        this.showAlert('SELF-DESTRUCT SEQUENCE INITIATED', 0);
        this._broadcastSocket('alert', { message: 'SELF-DESTRUCT SEQUENCE INITIATED' });
        break;

      case 'cancel_self_destruct':
        this.shipStatus?.update({ selfDestructActive: false, selfDestructTimer: null });
        this.hideAlert();
        this._broadcastSocket('alert', { message: 'SELF-DESTRUCT CANCELLED' });
        break;

      case 'update_crew_location':
      case 'assign_crew_task':
      case 'update_crew_status':
      case 'complete_crew_task':
      case 'update_ship_system':
      case 'add_log_entry':
      case 'set_game_time':
        // Forward to ship status manager
        if (this.shipStatus) {
          this.shipStatus.handleGmCommand(cmd);
          this.refreshCurrentView();
        }
        break;

      default:
        console.log('WY-Terminal | Unhandled engine GM command:', cmd.type);
    }
  }

  /* ── Scene View Setup ── */
  _setupScenesView(contentEl) {
    contentEl.querySelectorAll('[data-scene-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sceneId = e.currentTarget.dataset.sceneId;
        this.activeSceneId = sceneId;
        this._renderView('scenes');
      });
    });

    // Setup pinch-zoom on scene canvas
    const canvas = contentEl.querySelector('#wy-scene-canvas');
    const img = contentEl.querySelector('#wy-scene-img');
    if (canvas && img) {
      const sceneZoom = new PinchZoomHandler(canvas, img);
      // Store for cleanup
      this._sceneZoom = sceneZoom;
    }
  }

  /* ── Maps View Setup ── */
  _setupMapsView(contentEl) {
    contentEl.querySelectorAll('[data-map-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mapId = e.currentTarget.dataset.mapId;
        this.activeMapId = mapId;
        this._renderView('maps');
      });
    });

    // Setup pinch-zoom on map viewport
    const viewport = contentEl.querySelector('#wy-map-viewport');
    const img = contentEl.querySelector('#wy-map-img');
    if (viewport && img) {
      const mapZoom = new PinchZoomHandler(viewport, img);
      this._mapZoom = mapZoom;
    }
  }

  /* ── Emergency View Setup ── */
  _setupEmergencyView(contentEl) {
    contentEl.querySelectorAll('[data-emergency]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.emergency;
        this._handleEmergencyAction(action);
      });
    });
  }

  _handleEmergencyAction(action) {
    // These dispatch to the GM via socket + update status
    switch (action) {
      case 'self-destruct':
        if (game.user.isGM) {
          this.shipStatus?.update({ selfDestructActive: true, selfDestructTimer: '10:00:00' });
          this.showAlert('SELF-DESTRUCT SEQUENCE INITIATED', 0);
          this._broadcastSocket('alert', { message: 'SELF-DESTRUCT SEQUENCE INITIATED' });
        } else {
          ui.notifications.warn('AUTHORIZATION REQUIRED — GM ACCESS ONLY');
        }
        break;
      case 'cancel-self-destruct':
        if (game.user.isGM) {
          this.shipStatus?.update({ selfDestructActive: false, selfDestructTimer: null });
          this.hideAlert();
          this._broadcastSocket('alert', { message: 'SELF-DESTRUCT CANCELLED' });
        }
        break;
      case 'distress':
        this._addLog('EMERGENCY', 'DISTRESS SIGNAL BROADCAST ON ALL FREQUENCIES', 'critical');
        this.showAlert('DISTRESS SIGNAL BROADCASTING');
        break;
      case 'lockdown':
        this._addLog('SECURITY', 'SHIP LOCKDOWN INITIATED — ALL AIRLOCKS SEALED', 'warning');
        this.showAlert('SHIP LOCKDOWN ACTIVE');
        break;
      case 'evacuate':
        this._addLog('EMERGENCY', 'EVACUATION PROTOCOL INITIATED', 'critical');
        this.showAlert('EVACUATION PROTOCOL ACTIVE');
        break;
      case 'purge':
        this._addLog('EMERGENCY', 'ATMOSPHERE PURGE STANDING BY — SELECT DECK', 'critical');
        break;
    }
    this.refreshCurrentView();
  }

  /* ── Settings View Setup ── */
  _setupSettingsView(contentEl) {
    contentEl.querySelector('[data-action="save-settings"]')?.addEventListener('click', () => {
      this._saveSettingsFromForm(contentEl);
    });

    contentEl.querySelector('[data-action="reload-status"]')?.addEventListener('click', () => {
      this.shipStatus?.reload();
      ui.notifications.info('WY-Terminal: Ship status reloaded.');
      this.refreshCurrentView();
    });

    contentEl.querySelector('[data-action="clear-chat"]')?.addEventListener('click', () => {
      this.chatHistory = [];
      this._persistChatHistory();
      ui.notifications.info('WY-Terminal: Chat log cleared.');
    });
  }

  async _saveSettingsFromForm(contentEl) {
    const inputs = contentEl.querySelectorAll('[data-setting]');
    for (const input of inputs) {
      const key = input.dataset.setting;
      let value;
      if (input.type === 'checkbox') {
        value = input.checked;
      } else if (input.type === 'password') {
        // Only save if user actually entered a new value (not the masked placeholder)
        if (input.value && !input.value.startsWith('••')) {
          value = input.value;
        } else {
          continue; // Skip — keep existing value
        }
      } else {
        value = input.value;
      }
      try {
        await game.settings.set('wy-terminal', key, value);
      } catch (e) {
        console.warn(`WY-Terminal | Could not save setting "${key}":`, e);
      }
    }

    // If plugin changed, reinitialize the engine
    if (this.muthurBridge?.engine) {
      const newPlugin = game.settings.get('wy-terminal', 'muthurPlugin');
      if (newPlugin !== this.muthurBridge.engine.pluginName) {
        try {
          await this.muthurBridge.engine.switchPlugin(newPlugin);
        } catch (e) {
          console.warn('WY-Terminal | Plugin switch failed:', e);
        }
      }
    }

    ui.notifications.info('WY-Terminal: Configuration saved.');
    this.render(true);
  }

  /* ══════════════════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Get the MU/TH/UR header name from the engine.
   */
  _getMuthurHeader() {
    if (this.muthurBridge?.engine) {
      return this.muthurBridge.engine.getHeaderName();
    }
    return 'MU/TH/UR 6000 SERIES';
  }

  _getGameDate() {
    // Return the in-game date from world time, or a styled fallback
    try {
      const cal = game.time?.worldTime;
      if (cal) {
        const d = new Date(cal * 1000 + Date.UTC(2183, 5, 12));
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
      }
    } catch (e) { /* fallback */ }
    return '2183-06-12 06:00';
  }

  _getDisplayTitle() {
    const titles = {
      boot: 'SYSTEM BOOT',
      status: 'SHIP STATUS',
      crew: 'CREW MANIFEST',
      systems: 'SYSTEMS DIAGNOSTIC',
      logs: 'SHIP LOG',
      muthur: 'MU/TH/UR INTERFACE',
      scenes: 'SCENE VIEWER',
      maps: 'DIGITAL MAPS',
      emergency: 'EMERGENCY PROTOCOLS',
      nav: 'NAVIGATION',
      comms: 'COMMUNICATIONS',
      cargo: 'CARGO MANIFEST',
      settings: 'CONFIGURATION',
    };
    return titles[this.activeView] || 'TERMINAL';
  }

  _loadSetting(key) {
    try {
      return game.settings.get('wy-terminal', key) || [];
    } catch {
      return [];
    }
  }

  async _addLog(source, message, level = '') {
    const logs = this._loadSetting('logEntries');
    logs.unshift({
      timestamp: this._getGameDate(),
      source: source.toUpperCase(),
      message: message.toUpperCase(),
      level,
    });
    // Keep last 100 entries
    if (logs.length > 100) logs.length = 100;
    await game.settings.set('wy-terminal', 'logEntries', logs);
  }

  _broadcastSocket(type, payload) {
    game.socket.emit('module.wy-terminal', { type, payload });
  }
}
