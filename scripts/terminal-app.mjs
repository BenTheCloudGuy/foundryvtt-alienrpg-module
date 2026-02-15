/**
 * WYTerminalApp — The main Foundry Application window for the Weyland-Yutani Terminal.
 * Manages all terminal views, navigation, display frame with pinch-zoom,
 * scene rendering, and MU/TH/UR chat integration.
 */

import { PinchZoomHandler } from './pinch-zoom.mjs';
import { MuthurBridge } from './muthur-bridge.mjs';
import { MuthurEngine } from './muthur-engine.mjs';
import { getShipProfile, getAvailableProfiles } from './ship-profiles.mjs';
import { TerminalSFX } from './terminal-sounds.mjs';

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

    /** @type {Array} Cached log entries loaded from muthur/logs.json */
    this._fileLogCache = [];

    // Chat history starts empty — cleared on each send, no persistence needed
    this.chatHistory = [];

    /** @type {string|null} Last user query sent to MU/TH/UR AI (for resubmit after code entry) */
    this._lastMuthurQuery = null;

    // Load log entries from JSON file (async, fills cache before first view)
    this._loadFileLogEntries();
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

  /**
   * Get the active ship profile.
   */
  _getShipProfile() {
    const profileId = game.settings.get('wy-terminal', 'activeShip') || 'montero';
    return getShipProfile(profileId);
  }

  getData() {
    const profile = this._getShipProfile();
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
      isGM: game.user.isGM,
      activeClearance: this._getActiveClearance(),
      shipProfile: profile.id,
      uiTheme: profile.uiTheme,
      interfaceVersion: profile.interfaceVersion,
      extraNavButtons: profile.extraNavButtons || [],
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER & LIFECYCLE
     ══════════════════════════════════════════════════════════════════ */

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;

    // Preload sounds for player clients
    TerminalSFX.preload();

    // Navigation buttons
    el.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        TerminalSFX.play('beep');
        this._switchView(view);
      });
      // Touch support
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        const view = e.currentTarget.dataset.view;
        this._switchView(view);
      });
    });

    // Zoom buttons
    el.querySelector('[data-action="zoom-in"]')?.addEventListener('click', () => this.zoomHandler?.zoomIn());
    el.querySelector('[data-action="zoom-out"]')?.addEventListener('click', () => this.zoomHandler?.zoomOut());
    el.querySelector('[data-action="zoom-reset"]')?.addEventListener('click', () => this.zoomHandler?.reset());

    // Initialize pinch-zoom on the display frame (disabled until scenes view)
    const displayFrame = el.querySelector('#wy-display-frame');
    const displayContent = el.querySelector('#wy-display-content');
    if (displayFrame && displayContent) {
      this.zoomHandler = new PinchZoomHandler(displayFrame, displayContent);
      this.zoomHandler.enabled = false; // Only enabled for Ship Schematics view
    }

    // Render initial view
    this._renderView(this.activeView);
  }

  close(options) {
    // Prevent closing for player clients — terminal is always on
    if (!game.user.isGM) {
      console.log('WY-Terminal | Terminal cannot be closed on player display');
      return;
    }
    // GM can close for debugging
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

    // Clean up clock interval when leaving gameclock view
    this._clearClockInterval();
    // Clean up self-destruct countdown interval when leaving status view
    this._clearSelfDestructInterval();

    // Clear new-log flash when navigating to logs
    if (viewName === 'logs') {
      const el = this.element[0] ?? this.element;
      el.querySelector('[data-view="logs"]')?.classList.remove('wy-nav-flash');
    }

    // Clear emergency flash when navigating to status
    if (viewName === 'status') {
      const el = this.element[0] ?? this.element;
      el.querySelector('[data-view="status"]')?.classList.remove('wy-nav-flash-red');
    }

    // Update button active states
    const el = this.element[0] ?? this.element;
    el.querySelectorAll('[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update display title
    const titleEl = el.querySelector('#wy-display-title');
    if (titleEl) titleEl.textContent = this._getDisplayTitle();

    // Only allow zoom on scenes (ship schematics) view
    const zoomControls = el.querySelector('#wy-zoom-controls');
    const isSchematicsView = viewName === 'scenes';
    if (isSchematicsView) {
      if (zoomControls) zoomControls.style.display = '';
      if (this.zoomHandler) this.zoomHandler.enabled = true;
    } else {
      if (zoomControls) zoomControls.style.display = 'none';
      if (this.zoomHandler) {
        this.zoomHandler.enabled = false;
        this.zoomHandler.reset();
      }
    }

    // Screen-change sound for player terminal
    TerminalSFX.play('screenChange');

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

      // Toggle full-height mode for views that need it (muthur chat)
      const displayFrame = contentEl.closest('#wy-display-frame') ?? contentEl.parentElement;
      if (displayFrame) {
        displayFrame.classList.toggle('wy-fullheight-view', viewName === 'muthur');
      }

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
    // Alert klaxon for player terminal
    TerminalSFX.play('alert');

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

      case 'status': {
        const eStatus = this.shipStatus?.getStatus() ?? {};
        const sdActive = !!eStatus.selfDestructActive;
        const sdRemaining = sdActive ? this._getSelfDestructRemainingMs() : 0;
        return {
          ...base,
          systems: this._getSystemsData().map(s => ({
            ...s,
            statusClass: this._statusToClass(s.status),
          })),
          selfDestructActive: sdActive,
          selfDestructTimer: sdActive ? this._formatCountdown(sdRemaining) : '',
          selfDestructArmedBy: eStatus.selfDestructArmedBy || '',
          evacuationActive: !!eStatus.evacuationActive,
          evacuationTriggeredBy: eStatus.evacuationTriggeredBy || '',
          lockdownActive: !!eStatus.lockdownActive,
          lockdownTriggeredBy: eStatus.lockdownTriggeredBy || '',
          distressActive: !!eStatus.distressActive,
          distressTriggeredBy: eStatus.distressTriggeredBy || '',
          purgeActive: !!eStatus.purgeActive,
          purgeTriggeredBy: eStatus.purgeTriggeredBy || '',
          purgeTarget: eStatus.purgeTarget || '',
          hasActiveEmergency: sdActive || !!eStatus.evacuationActive || !!eStatus.lockdownActive || !!eStatus.distressActive || !!eStatus.purgeActive,
          isGM: game.user.isGM,
        };
      }

      case 'crew':
        return { ...base, crew: this._getCrewData(), activeTasks: this._getActiveTasksData(), isGM: game.user.isGM };

      case 'systems':
        return { ...base, systems: this._getSystemsDetailData(), isGM: game.user.isGM };

      case 'logs':
        return { ...base, logs: this._getLogData(), isGM: game.user.isGM, activeClearance: this._getActiveClearance() };

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
        return { ...base, ...this._getCargoViewData() };

      case 'commandcode':
        return { ...base, activeClearance: this._getActiveClearance(), commandCodes: this._loadCommandCodes(), isGM: game.user.isGM };

      case 'gameclock':
        return { ...base, ...this._getGameClockDisplayData() };

      case 'weapons':
        return { ...base, ...this._getWeaponsData() };

      case 'science':
        return { ...base, ...this._getScienceData() };

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
          activeShip: game.settings.get('wy-terminal', 'activeShip'),
          availableShips: getAvailableProfiles(),
          navData: this._getNavSettingsData(),
          activeClearance: this._getActiveClearance(),
          isGM: game.user.isGM,
        };

      default:
        return base;
    }
  }

  /* ── System helpers ── */
  _statusToClass(status) {
    switch (status) {
      case 'ONLINE': case 'NOMINAL': return 'online';
      case 'WARNING': return 'warning';
      case 'CRITICAL': return 'critical';
      case 'OFFLINE': default: return 'offline';
    }
  }

  /* ── System data ── */
  _getSystemsData() {
    const systems = this._loadSetting('shipSystems');
    if (systems.length) return systems;

    // Use defaults from active ship profile
    const profile = this._getShipProfile();
    return [...profile.defaultSystems];
  }

  _getSystemsDetailData() {
    const systems = this._getSystemsData();
    return systems.map((s, idx) => {
      const statusClass = this._statusToClass(s.status);
      const pct = s.powerPct ?? (statusClass === 'online' ? 100 : statusClass === 'warning' ? 60 : 0);
      return {
        ...s,
        idx,
        statusClass,
        power: pct > 0 ? 'ACTIVE' : 'OFFLINE',
        notes: s.detail,
        powerPct: pct,
        statusTextClass: statusClass === 'online' ? 'wy-text-green' :
          statusClass === 'warning' ? 'wy-text-amber' :
            statusClass === 'critical' ? 'wy-text-red' : 'wy-text-dim',
        powerColor: statusClass === 'online' ? 'var(--wy-green)' :
          statusClass === 'warning' ? 'var(--wy-amber)' : 'var(--wy-red)',
      };
    });
  }

  /* ── Crew data ── */
  _getCrewData() {
    const crew = this._loadSetting('crewRoster');
    if (crew.length) return crew;

    // Use defaults from active ship profile
    const profile = this._getShipProfile();
    return [...profile.defaultCrew];
  }

  _getActiveTasksData() {
    // Could be populated from ship status
    const status = this.shipStatus?.getStatus() ?? {};
    return status.activeTasks || [];
  }

  /* ── Log data ── */
  _getLogData() {
    // Merge logs from the JSON file (loaded at init) and runtime setting
    const fileLogs = this._fileLogCache || [];
    const settingLogs = this._loadSetting('logEntries');

    // Merge: setting logs first, then file logs
    // Deduplicate by id if present
    const seen = new Set();
    const merged = [];
    for (const log of [...settingLogs, ...fileLogs]) {
      const key = log.id || `${log.timestamp}-${log.subject || log.title || log.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({
          id: log.id || key,
          timestamp: log.timestamp || '',
          sender: (log.sender || log.source || 'SYSTEM').toUpperCase(),
          subject: (log.subject || log.title || log.message || 'UNTITLED').toUpperCase(),
          level: log.level || '',
          detail: log.detail || log.message || '',
          mediaType: log.mediaType || 'text',
          mediaUrl: log.mediaUrl || '',
          classification: (log.classification || '').toUpperCase(),
        });
      }
    }

    // Sort by timestamp ascending (oldest first)
    merged.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return merged;
  }

  /**
   * Load log entries from ship-specific muthur/logs-{shipId}.json file.
   * Called during initialization and when switching ships.
   */
  async _loadFileLogEntries() {
    const profileId = (game.settings.get('wy-terminal', 'activeShip') || 'montero');
    const logFile = `modules/wy-terminal/muthur/logs-${profileId}.json`;
    try {
      const resp = await fetch(logFile, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this._fileLogCache = Array.isArray(data.logs) ? data.logs : [];
      console.log(`WY-Terminal | Loaded ${this._fileLogCache.length} log entries from logs-${profileId}.json`);
    } catch (err) {
      console.warn(`WY-Terminal | Could not load ${logFile}:`, err.message);
      this._fileLogCache = [];
    }
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
    return {};
  }

  /* ── Emergency data ── */
  _getEmergencyData() {
    const status = this.shipStatus?.getStatus() ?? {};
    const sdActive = !!status.selfDestructActive;
    const remaining = sdActive ? this._getSelfDestructRemainingMs() : 0;
    return {
      selfDestructActive: sdActive,
      selfDestructTimer: sdActive ? this._formatCountdown(remaining) : '00:00:00',
      selfDestructArmedBy: status.selfDestructArmedBy || '',
      evacuationActive: !!status.evacuationActive,
      evacuationTriggeredBy: status.evacuationTriggeredBy || '',
      lockdownActive: !!status.lockdownActive,
      lockdownTriggeredBy: status.lockdownTriggeredBy || '',
      distressActive: !!status.distressActive,
      distressTriggeredBy: status.distressTriggeredBy || '',
      purgeActive: !!status.purgeActive,
      purgeTriggeredBy: status.purgeTriggeredBy || '',
      purgeTarget: status.purgeTarget || '',
      isGM: game.user.isGM,
    };
  }

  /* ── Nav settings data (for GM controls form) ── */
  _getNavSettingsData() {
    const nav = this._loadSetting('navData') || {};
    // Pull engine/thruster status from systems
    const systems = this._getSystemsData();
    const engSys = systems.find(s => s.name === 'ENGINES');
    const thrSys = systems.find(s => /THRUSTER/i.test(s.name));
    return {
      heading: nav.heading || '',
      speed: nav.speed || '',
      fuel: nav.fuel || '',
      eta: nav.eta || '',
      position: nav.position || '',
      destination: nav.destination || '',
      engineStatus: engSys?.status || 'ONLINE',
      thrusterStatus: thrSys?.status || 'NOMINAL',
    };
  }

  /* ── Nav data ── */
  _getNavData() {
    const nav = this._loadSetting('navData') || {};
    const systems = this._getSystemsData();
    const engSys = systems.find(s => s.name === 'ENGINES');
    const thrSys = systems.find(s => /THRUSTER/i.test(s.name));
    const engineStatus = engSys?.status || 'ONLINE';
    const thrusterStatus = thrSys?.status || 'NOMINAL';

    const fuel = nav.fuel || '87%';
    const fuelNum = parseInt(fuel) || 87;
    let fuelClass = 'wy-text-green';
    if (fuelNum <= 25) fuelClass = 'wy-text-red';
    else if (fuelNum <= 50) fuelClass = 'wy-text-amber';
    return {
      currentPosition: nav.position || 'SECTOR 87-C / ZETA RETICULI',
      destination: nav.destination || 'NOT SET',
      heading: nav.heading || '042.7',
      eta: nav.eta || 'N/A',
      speed: nav.speed || 'STATION KEEPING',
      fuelLevel: fuel,
      fuelClass,
      engineStatus,
      engineClass: (engineStatus === 'OFFLINE') ? 'wy-text-red' : 'wy-text-green',
      thrusterStatus,
      thrusterClass: (thrusterStatus === 'OFFLINE') ? 'wy-text-red' : 'wy-text-green',
      navPoints: nav.navPoints || [],
      // Star map route data for canvas
      shipPos: nav.shipPos || { x: 0.72, y: 0.45 },
      routePoints: nav.routePoints || [
        { x: 0.72, y: 0.45, label: 'CURRENT' },
        { x: 0.58, y: 0.38, label: '' },
        { x: 0.42, y: 0.32, label: 'DESTINATION' },
      ],
    };
  }

  /* ── Comms data ── */
  _getCommsData() {
    // Derive COMM STATUS from the COMMS ARRAY entry in shipSystems
    const systems = this._getSystemsData();
    const commsArray = systems.find(s => s.name?.toUpperCase().includes('COMMS'));
    const commsStatus = commsArray?.status || 'ONLINE';
    const commsStatusClass = this._statusToClass(commsStatus);

    // Frequency from dedicated setting
    let freq;
    try { freq = game.settings.get('wy-terminal', 'commFrequency'); } catch { freq = ''; }
    if (!freq) freq = '475.12';

    // Range varies by status
    const range = commsStatusClass === 'offline' ? 'N/A' :
                  commsStatusClass === 'critical' ? '10 AU' :
                  commsStatusClass === 'warning' ? '50 AU' : '100 AU';

    const status = this.shipStatus?.getStatus() ?? {};

    return {
      commStatus: commsStatus,
      commStatusClass: commsStatusClass,
      commFrequency: `${freq} MHz`,
      commRange: range,
      messages: status.messages || [],
      isGM: game.user.isGM,
    };
  }

  /* ── Cargo data ── */
  _getCargoData() {
    const stored = this._loadSetting('cargoManifest');
    if (stored?.length) return stored;
    const profile = this._getShipProfile();
    return profile?.defaultCargo ?? [];
  }

  /**
   * Full view-data for cargo template (list + form helpers).
   */
  _getCargoViewData() {
    const cargoItems = this._getCargoData();
    // Build location optgroup data for form dropdown (reusing crew logic)
    const shipLocations = this._getLocationOptionGroups();
    return { cargoItems, shipLocations, isGM: game.user.isGM };
  }

  /**
   * Return location optgroups array for <select> dropdowns.
   * Shared by crew and cargo forms.
   */
  _getLocationOptionGroups() {
    const UNIVERSAL = ['UNKNOWN', 'UMBILICAL', 'EXTERNAL'];
    const MONTERO = ['BRIDGE', 'MEDLAB', 'GALLERY', 'CRYO', 'CARGO BAY', 'ENGINEERING', 'EVA LOCKER', 'SUPPLY CLOSET', 'TOOL LOCKER'];
    const CRONUS = [
      '(DECK D) VEHICLE BAY',
      '(DECK C) REACTOR', '(DECK C) JUNCTION C-2', '(DECK C) CARGO BAY 1', '(DECK C) CARGO BAY 2', '(DECK C) CARGO OFFICE', '(DECK C) JUNCTION C-1', '(DECK C) FORWARD', '(DECK C) AFT',
      '(DECK B) BRIDGE', '(DECK B) JUNCTION B-1', '(DECK B) VESTIBULE 1', '(DECK B) VESTIBULE 2', '(DECK B) MESS HALL', '(DECK B) CORPORATE SUITE', '(DECK B) LIVING AREA', '(DECK B) JUNCTION B-2', '(DECK B) MEDLAB', '(DECK B) SCI LAB 2', '(DECK B) SCI LAB 1', '(DECK B) SCIENCE SECTOR', '(DECK B) FORWARD', '(DECK B) AFT',
      '(DECK A) MU/TH/UR', '(DECK A) JUNCTION A-1', '(DECK A) EXAMINATION ROOM', '(DECK A) JUNCTION A-2', '(DECK A) CRYO SECTOR', '(DECK A) FORWARD', '(DECK A) AFT',
      'ARMORY',
    ];

    const groups = [{ group: 'GENERAL', items: UNIVERSAL }];
    groups.push({ group: 'MONTERO', items: MONTERO });
    groups.push({ group: 'CRONUS — DECK D', items: CRONUS.filter(l => l.startsWith('(DECK D)')) });
    groups.push({ group: 'CRONUS — DECK C', items: CRONUS.filter(l => l.startsWith('(DECK C)')) });
    groups.push({ group: 'CRONUS — DECK B', items: CRONUS.filter(l => l.startsWith('(DECK B)')) });
    groups.push({ group: 'CRONUS — DECK A', items: CRONUS.filter(l => l.startsWith('(DECK A)')) });
    groups.push({ group: 'CRONUS — OTHER', items: CRONUS.filter(l => !l.startsWith('(DECK')) });
    return groups;
  }

  /* ── Weapons data (Cronus tactical systems) ── */
  _getWeaponsData() {
    const profile = this._getShipProfile();
    const systems = this._getSystemsDetailData();
    const weaponNames = ['RAIL GUN', 'MISSILE BATTERY', 'POINT DEFENSE SYS'];

    const weapons = systems
      .filter(s => weaponNames.includes(s.name))
      .map(s => ({
        name: s.name,
        status: s.status,
        statusClass: this._statusToClass(s.status),
        statusTextClass: `wy-text-${this._statusToClass(s.status) === 'online' ? 'green' : this._statusToClass(s.status) === 'warning' ? 'amber' : 'red'}`,
        ammo: s.name === 'MISSILE BATTERY' ? (s.detail || '12 RDS LOADED') : '∞',
        notes: s.detail || '',
        powerPct: s.powerPct ?? 100,
        powerColor: (s.powerPct ?? 100) > 60 ? '#ff3333' : (s.powerPct ?? 100) > 30 ? '#ffbf00' : '#555',
      }));

    // If no weapons found in systems, use defaults from profile
    if (weapons.length === 0) {
      const defaults = profile.defaultSystems.filter(s => weaponNames.includes(s.name));
      weapons.push(...defaults.map(s => ({
        name: s.name,
        status: s.status,
        statusClass: this._statusToClass(s.status),
        statusTextClass: 'wy-text-green',
        ammo: s.name === 'MISSILE BATTERY' ? (s.detail || '12 RDS LOADED') : '∞',
        notes: s.detail || '',
        powerPct: s.powerPct ?? 100,
        powerColor: '#ff3333',
      })));
    }

    return {
      weapons,
      targetingMode: 'AUTO-TRACK',
      targetLock: 'NO LOCK',
      targetLockClass: 'wy-text-dim',
      threatLevel: 'NONE DETECTED',
      threatClass: 'wy-text-green',
    };
  }

  /* ── Science data (Cronus research pod) ── */
  _getScienceData() {
    return {
      labs: [
        { name: 'LAB-A (XENOBIOLOGY)',    status: 'ACTIVE',  statusClass: 'online', statusTextClass: 'wy-text-green', assignment: 'SPECIMEN ANALYSIS', notes: 'LV-1113 SAMPLES' },
        { name: 'LAB-B (PATHOLOGY)',       status: 'ACTIVE',  statusClass: 'online', statusTextClass: 'wy-text-green', assignment: 'BIO-HAZARD SCREENING', notes: 'LEVEL 4 CONTAINMENT' },
        { name: 'CRYO RESEARCH UNIT',      status: 'STANDBY', statusClass: 'warning', statusTextClass: 'wy-text-amber', assignment: 'UNASSIGNED', notes: '—' },
      ],
      specimens: [
        { unit: 'UNIT-01', containment: 'SEALED',  statusClass: 'online',  statusTextClass: 'wy-text-green', hazardLevel: 'LEVEL 4', hazardClass: 'wy-text-red',   contents: 'ORGANIC SAMPLE — LV-1113' },
        { unit: 'UNIT-02', containment: 'SEALED',  statusClass: 'online',  statusTextClass: 'wy-text-green', hazardLevel: 'LEVEL 2', hazardClass: 'wy-text-amber', contents: 'ATMOSPHERIC RESIDUE' },
        { unit: 'UNIT-03', containment: 'VACANT',  statusClass: 'offline', statusTextClass: 'wy-text-dim',   hazardLevel: '—',       hazardClass: 'wy-text-dim',   contents: '—' },
        { unit: 'UNIT-04', containment: 'VACANT',  statusClass: 'offline', statusTextClass: 'wy-text-dim',   hazardLevel: '—',       hazardClass: 'wy-text-dim',   contents: '—' },
      ],
      atmosphere: 'NOMINAL',
      radiation: 'SAFE',
      radiationClass: 'wy-text-green',
      bioContaminant: 'NEGATIVE',
      bioClass: 'wy-text-green',
      quarantine: 'INACTIVE',
      quarantineClass: 'wy-text-dim',
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     POST-RENDER HOOKS — Wire up view-specific interactions
     ══════════════════════════════════════════════════════════════════ */

  _onViewRendered(viewName, contentEl) {
    // Boot sound for player terminal
    if (viewName === 'boot') TerminalSFX.play('boot');

    switch (viewName) {
      case 'status':
        this._setupStatusView(contentEl);
        break;
      case 'logs':
        this._setupLogsView(contentEl);
        break;
      case 'muthur':
        this._setupMuthurView(contentEl);
        break;
      case 'scenes':
        this._setupScenesView(contentEl);
        break;
      case 'maps':
        this._setupMapsView(contentEl);
        break;
      case 'systems':
        this._setupSystemsView(contentEl);
        break;
      case 'emergency':
        this._setupEmergencyView(contentEl);
        break;
      case 'settings':
        this._setupSettingsView(contentEl);
        break;
      case 'nav':
        this._setupNavView(contentEl);
        break;
      case 'crew':
        this._setupCrewView(contentEl);
        break;
      case 'commandcode':
        this._setupCommandCodeView(contentEl);
        break;
      case 'cargo':
        this._setupCargoView(contentEl);
        break;
      case 'comms':
        this._setupCommsView(contentEl);
        break;
      case 'gameclock':
        this._setupGameClockView(contentEl);
        break;
      case 'weapons':
      case 'science':
        // Read-only views — no interactive setup needed
        break;
    }
  }

  /* ── Logs View Setup — List/Detail views + GM form ── */
  _setupLogsView(contentEl) {
    // Cache log data for detail view lookup
    this._currentLogs = this._getLogData();
    this._editingLogId = null; // Track if we're editing an existing log

    const listView = contentEl.querySelector('#wy-log-list-view');
    const detailView = contentEl.querySelector('#wy-log-detail-view');

    // [VIEW] button handler — open detail view for selected log
    contentEl.querySelectorAll('[data-action="view-log"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const logId = btn.dataset.logId;
        const log = this._currentLogs.find(l => l.id === logId);
        if (!log) return;

        // Check classification-based access (GM always passes)
        if (!game.user.isGM && log.classification) {
          const clearance = this._getActiveClearance();
          if (!this._canAccessClassification(log.classification, clearance)) {
            const required = this._requiredClearanceFor(log.classification);
            ui.notifications.warn(`ACCESS DENIED — ${log.classification} CLASSIFIED. REQUIRES ${required} CLEARANCE OR HIGHER.`);
            return;
          }
        }

        // Populate detail header
        const dateEl = contentEl.querySelector('#wy-log-detail-date');
        const senderEl = contentEl.querySelector('#wy-log-detail-sender');
        const subjectEl = contentEl.querySelector('#wy-log-detail-subject');
        const bodyEl = contentEl.querySelector('#wy-log-detail-body');

        if (dateEl) dateEl.textContent = `[${log.timestamp}]`;
        if (senderEl) senderEl.textContent = log.sender;
        if (subjectEl) subjectEl.textContent = log.subject;

        // Populate body based on media type
        if (bodyEl) {
          bodyEl.innerHTML = '';

          if (log.mediaType === 'image' && log.mediaUrl) {
            const img = document.createElement('img');
            img.className = 'wy-log-media-img';
            img.src = log.mediaUrl;
            img.alt = log.subject;
            bodyEl.appendChild(img);
          } else if (log.mediaType === 'video' && log.mediaUrl) {
            const video = document.createElement('video');
            video.className = 'wy-log-media-video';
            video.src = log.mediaUrl;
            video.controls = true;
            video.autoplay = false;
            bodyEl.appendChild(video);
          }

          // Always show detail text if present
          if (log.detail) {
            const pre = document.createElement('pre');
            pre.className = 'wy-log-detail-text';
            pre.textContent = log.detail;
            bodyEl.appendChild(pre);
          }
        }

        // Apply level class to detail container
        const container = contentEl.querySelector('.wy-log-detail-container');
        if (container) {
          container.className = `wy-log-detail-container ${log.level || ''}`;
        }

        // Show detail, hide list
        this._currentDetailLog = log;
        listView?.classList.add('wy-hidden');
        detailView?.classList.remove('wy-hidden');
      });
    });

    // [CLOSE] button handler — return to list
    contentEl.querySelector('[data-action="close-log"]')?.addEventListener('click', () => {
      detailView?.classList.add('wy-hidden');
      listView?.classList.remove('wy-hidden');
    });

    // GM: [EDIT] button in detail view — populate form with current log data
    contentEl.querySelector('[data-action="edit-log"]')?.addEventListener('click', () => {
      if (!game.user.isGM || !this._currentDetailLog) return;
      const log = this._currentDetailLog;
      this._editingLogId = log.id;

      const form = contentEl.querySelector('#wy-log-form');
      const formTitle = contentEl.querySelector('#wy-log-form-title');
      if (!form) return;

      // Update form title
      if (formTitle) formTitle.textContent = 'EDIT LOG ENTRY';

      // Populate form fields with existing data
      const dateInput = contentEl.querySelector('#wy-log-form-date');
      const senderInput = contentEl.querySelector('#wy-log-form-sender');
      const subjectInput = contentEl.querySelector('#wy-log-form-subject');
      const levelSelect = contentEl.querySelector('#wy-log-form-level');
      const classSelect = contentEl.querySelector('#wy-log-form-classification');
      const mediaSelect = contentEl.querySelector('#wy-log-form-media-type');
      const mediaUrlInput = contentEl.querySelector('#wy-log-form-media-url');
      const mediaUrlRow = contentEl.querySelector('#wy-log-form-media-url-row');
      const detailInput = contentEl.querySelector('#wy-log-form-detail');

      if (dateInput) dateInput.value = log.timestamp || '';
      if (senderInput) senderInput.value = log.sender || '';
      if (subjectInput) subjectInput.value = log.subject || '';
      if (levelSelect) levelSelect.value = log.level || '';
      if (classSelect) classSelect.value = log.classification || '';
      if (mediaSelect) mediaSelect.value = log.mediaType || 'text';
      if (mediaUrlInput) mediaUrlInput.value = log.mediaUrl || '';
      if (mediaUrlRow) mediaUrlRow.classList.toggle('wy-hidden', (log.mediaType || 'text') === 'text');
      if (detailInput) detailInput.value = log.detail || '';

      // Switch views: hide detail, show list + form
      detailView?.classList.add('wy-hidden');
      listView?.classList.remove('wy-hidden');
      form.classList.remove('wy-hidden');
      form.scrollIntoView({ behavior: 'smooth' });
    });

    // GM: delete log entry (from detail view)
    contentEl.querySelector('[data-action="delete-log"]')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const logId = this._currentDetailLog?.id;
      if (!logId || !game.user.isGM) return;

      // Remove from runtime setting logs
      const settingLogs = this._loadSetting('logEntries');
      const filtered = settingLogs.filter(l => l.id !== logId);
      if (filtered.length < settingLogs.length) {
        await game.settings.set('wy-terminal', 'logEntries', filtered);
      }

      // Also remove from file log cache (so it stays gone until reset)
      if (this._fileLogCache) {
        this._fileLogCache = this._fileLogCache.filter(l => l.id !== logId);
      }

      ui.notifications.info('WY-Terminal: Log entry deleted.');
      this._broadcastSocket('refreshView', { view: 'logs' });
      this._renderView('logs');
    });

    // GM: show/hide new log form
    const addBtn = contentEl.querySelector('[data-action="add-log"]');
    const form = contentEl.querySelector('#wy-log-form');
    if (addBtn && form) {
      addBtn.addEventListener('click', () => {
        // Reset to create mode
        this._editingLogId = null;
        const formTitle = contentEl.querySelector('#wy-log-form-title');
        if (formTitle) formTitle.textContent = 'CREATE NEW LOG ENTRY';
        // Clear form fields
        const dateInput = contentEl.querySelector('#wy-log-form-date');
        if (dateInput) dateInput.value = this._getGameDate();
        contentEl.querySelector('#wy-log-form-sender').value = '';
        contentEl.querySelector('#wy-log-form-subject').value = '';
        contentEl.querySelector('#wy-log-form-level').value = '';
        contentEl.querySelector('#wy-log-form-classification').value = '';
        contentEl.querySelector('#wy-log-form-media-type').value = 'text';
        contentEl.querySelector('#wy-log-form-media-url').value = '';
        contentEl.querySelector('#wy-log-form-media-url-row')?.classList.add('wy-hidden');
        contentEl.querySelector('#wy-log-form-detail').value = '';
        form.classList.toggle('wy-hidden');
      });
    }

    // GM: media type toggle — show/hide URL field
    const mediaTypeSelect = contentEl.querySelector('#wy-log-form-media-type');
    const mediaUrlRow = contentEl.querySelector('#wy-log-form-media-url-row');
    if (mediaTypeSelect && mediaUrlRow) {
      mediaTypeSelect.addEventListener('change', () => {
        const isMedia = mediaTypeSelect.value !== 'text';
        mediaUrlRow.classList.toggle('wy-hidden', !isMedia);
      });
    }

    // GM: cancel log form
    contentEl.querySelector('[data-action="cancel-log"]')?.addEventListener('click', () => {
      this._editingLogId = null;
      const formTitle = contentEl.querySelector('#wy-log-form-title');
      if (formTitle) formTitle.textContent = 'CREATE NEW LOG ENTRY';
      form?.classList.add('wy-hidden');
    });

    // GM: submit log form (create or update)
    contentEl.querySelector('[data-action="submit-log"]')?.addEventListener('click', async () => {
      const dateVal = contentEl.querySelector('#wy-log-form-date')?.value || '';
      const sender = contentEl.querySelector('#wy-log-form-sender')?.value || 'SYSTEM';
      const subject = contentEl.querySelector('#wy-log-form-subject')?.value || 'UNTITLED';
      const level = contentEl.querySelector('#wy-log-form-level')?.value || '';
      const detail = contentEl.querySelector('#wy-log-form-detail')?.value || '';
      const mediaType = contentEl.querySelector('#wy-log-form-media-type')?.value || 'text';
      const mediaUrl = contentEl.querySelector('#wy-log-form-media-url')?.value || '';
      const classification = contentEl.querySelector('#wy-log-form-classification')?.value || '';

      if (!subject.trim()) {
        ui.notifications.warn('WY-Terminal: Log subject is required.');
        return;
      }

      if (this._editingLogId) {
        // ── UPDATE existing log ──
        const logs = this._loadSetting('logEntries');
        const idx = logs.findIndex(l => l.id === this._editingLogId);
        if (idx !== -1) {
          logs[idx] = {
            ...logs[idx],
            timestamp: dateVal || logs[idx].timestamp,
            sender: sender.toUpperCase(),
            subject: subject.toUpperCase(),
            level,
            detail: (detail || subject).toUpperCase(),
            mediaType: mediaType || 'text',
            mediaUrl: mediaUrl || '',
            classification: (classification || '').toUpperCase(),
          };
          await game.settings.set('wy-terminal', 'logEntries', logs);

          // Also update file cache if present
          if (this._fileLogCache) {
            const cacheIdx = this._fileLogCache.findIndex(l => l.id === this._editingLogId);
            if (cacheIdx !== -1) {
              this._fileLogCache[cacheIdx] = { ...logs[idx] };
            }
          }

          ui.notifications.info('WY-Terminal: Log entry updated.');
        } else {
          ui.notifications.warn('WY-Terminal: Could not find log to update.');
        }
        this._editingLogId = null;
      } else {
        // ── CREATE new log ──
        await this._addLog(sender, subject, level, detail || subject, mediaType, mediaUrl, dateVal, classification);
        ui.notifications.info('WY-Terminal: Log entry created.');
        // Alert player terminals — flash the LOGS button
        console.log('WY-Terminal | Broadcasting newLogAlert to player terminals');
        this._broadcastSocket('newLogAlert', {});
      }

      // Refresh logs view and broadcast to players
      this._renderView('logs');
      this._broadcastSocket('refreshView', { view: 'logs' });
    });
  }

  /* ── Systems View Setup — GM configuration ── */
  _setupSystemsView(contentEl) {
    if (!game.user.isGM) return;

    // Status dropdown changes → auto-update statusClass indicator & power bar preview
    contentEl.querySelectorAll('.wy-sys-status').forEach(sel => {
      sel.addEventListener('change', () => {
        const row = sel.closest('tr');
        if (!row) return;
        const indicator = row.querySelector('.wy-indicator');
        const pctInput = row.querySelector('.wy-sys-pct');
        const pctLabel = row.querySelector('.wy-sys-pct-label');
        const barFill = row.closest('.wy-view-systems')
          ?.querySelector(`.wy-power-bar-fill[data-idx="${row.dataset.idx}"]`);

        // Derive class from new status
        const cls = { ONLINE: 'online', NOMINAL: 'online', WARNING: 'warning', CRITICAL: 'critical', OFFLINE: 'offline' }[sel.value] || 'offline';
        if (indicator) { indicator.className = `wy-indicator ${cls}`; }

        // Auto-set percentage based on status (GM can still override)
        const autoPct = { ONLINE: 100, NOMINAL: 100, WARNING: 60, CRITICAL: 30, OFFLINE: 0 }[sel.value] ?? 0;
        if (pctInput) pctInput.value = autoPct;
        if (pctLabel) pctLabel.textContent = `${autoPct}%`;
        if (barFill) {
          barFill.style.width = `${autoPct}%`;
          barFill.style.background = cls === 'online' ? 'var(--wy-green)' : cls === 'warning' ? 'var(--wy-amber)' : 'var(--wy-red)';
        }
      });
    });

    // Range slider live preview
    contentEl.querySelectorAll('.wy-sys-pct').forEach(input => {
      input.addEventListener('input', () => {
        const row = input.closest('tr');
        const pctLabel = row?.querySelector('.wy-sys-pct-label');
        const barFill = input.closest('.wy-view-systems')
          ?.querySelector(`.wy-power-bar-fill[data-idx="${row?.dataset.idx}"]`);
        if (pctLabel) pctLabel.textContent = `${input.value}%`;
        if (barFill) barFill.style.width = `${input.value}%`;
      });
    });

    // Save button
    const saveBtn = contentEl.querySelector('[data-action="save-systems"]');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', async () => {
      const rows = contentEl.querySelectorAll('.wy-sys-row');
      const newSystems = [];
      rows.forEach(row => {
        newSystems.push({
          name: row.querySelector('.wy-sys-name')?.value?.trim() || 'UNKNOWN',
          status: row.querySelector('.wy-sys-status')?.value || 'OFFLINE',
          detail: row.querySelector('.wy-sys-detail')?.value?.trim() || '',
          powerPct: parseInt(row.querySelector('.wy-sys-pct')?.value ?? '0', 10),
        });
      });

      // Detect status changes vs current saved data
      const oldSystems = this._getSystemsData();
      const changes = [];
      for (const ns of newSystems) {
        const os = oldSystems.find(s => s.name === ns.name);
        if (os && os.status !== ns.status) {
          changes.push({ name: ns.name, from: os.status, to: ns.status });
        }
      }

      // If GM made status changes, prompt for reason (timestamp from game clock)
      let reason = '';
      const logTimestamp = this._getGameDate();
      if (changes.length && game.user.isGM) {
        const changeList = changes.map(c => `  ${c.name}: ${c.from} → ${c.to}`).join('\n');
        reason = await new Promise(resolve => {
          new Dialog({
            title: 'System Status Change — Log Entry',
            content: `
              <p style="margin-bottom:8px;">The following system status changes were detected:</p>
              <pre style="background:rgba(0,0,0,.3);padding:8px;border:1px solid #555;white-space:pre-wrap;font-family:monospace;font-size:12px;margin-bottom:12px;">${changeList}</pre>

              <div style="margin-bottom:12px;padding:8px;border:1px solid #555;background:rgba(0,0,0,.2);text-align:center;">
                <span style="font-size:11px;opacity:.7;letter-spacing:1px;">GAME CLOCK</span><br>
                <span style="font-family:monospace;font-size:16px;font-weight:bold;">${logTimestamp}</span>
              </div>

              <label style="display:block;margin-bottom:4px;font-weight:bold;">Reason / Cause:</label>
              <textarea id="wy-sys-reason" style="width:100%;height:60px;resize:vertical;font-family:monospace;" placeholder="e.g. Hull breach in cargo bay"></textarea>
            `,
            buttons: {
              ok: {
                label: 'Save',
                callback: (html) => resolve(html.find('#wy-sys-reason').val()?.trim() || ''),
              },
              skip: {
                label: 'Skip',
                callback: () => resolve(''),
              },
            },
            default: 'ok',
            close: () => resolve(''),
          }).render(true);
        });
      }

      // Persist systems
      await game.settings.set('wy-terminal', 'shipSystems', newSystems);

      // Create log entries for each status change
      for (const c of changes) {
        const lvl = (c.to === 'OFFLINE' || c.to === 'CRITICAL') ? 'error' :
                    c.to === 'WARNING' ? 'warning' : 'info';
        const detail = reason
          ? `${c.name}: ${c.from} → ${c.to}\nREASON: ${reason}`
          : `${c.name}: ${c.from} → ${c.to}`;
        await this._addLog('MU/TH/UR', `SYSTEM STATUS CHANGE: ${c.name}`, lvl, detail, 'text', '', logTimestamp);
      }
      if (changes.length) {
        this._broadcastSocket('newLogAlert', {});
      }

      ui.notifications.info('WY-Terminal: Ship systems updated.');
      this._broadcastSocket('refreshView', { view: 'systems' });
      this._broadcastSocket('refreshView', { view: 'comms' });
      this._broadcastSocket('refreshView', { view: 'logs' });
      this._renderView('systems');
    });

    // Add System button
    const addBtn = contentEl.querySelector('[data-action="add-system"]');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const current = this._getSystemsData();
        current.push({ name: 'NEW SYSTEM', status: 'OFFLINE', detail: '', powerPct: 0 });
        await game.settings.set('wy-terminal', 'shipSystems', current);
        this._broadcastSocket('refreshView', { view: 'systems' });
        this._broadcastSocket('refreshView', { view: 'comms' });
        this._renderView('systems');
      });
    }

    // Remove System buttons
    contentEl.querySelectorAll('[data-action="remove-system"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const current = this._getSystemsData();
        current.splice(idx, 1);
        await game.settings.set('wy-terminal', 'shipSystems', current);
        this._broadcastSocket('refreshView', { view: 'systems' });
        this._broadcastSocket('refreshView', { view: 'comms' });
        this._renderView('systems');
      });
    });
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
        input.focus();
      }
    });

    // On-screen keyboard (touch-friendly)
    contentEl.querySelectorAll('.wy-osk-key').forEach(key => {
      key.addEventListener('click', (e) => {
        e.preventDefault();
        if (!input) return;
        const k = key.dataset.key;
        if (k === 'ENTER') {
          if (input.value.trim()) {
            this._sendMuthurMessage(input.value);
            input.value = '';
          }
        } else if (k === 'BACKSPACE') {
          input.value = input.value.slice(0, -1);
        } else {
          input.value += k;
        }
        input.focus();
      });
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
      // Injected response from GM — display immediately (replace, don't accumulate)
      this.chatHistory = [{ type: type || 'muthur', text }];
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

    // Typing sound when player sends a message
    TerminalSFX.play('typeSend');

    // ── Check if input is a valid command code ──
    const codeResult = await this._tryCommandCodeInMuthur(userMsg);
    if (codeResult) {
      this.chatHistory = [{ type: 'muthur', text: codeResult }];
      TerminalSFX.play('typeResponse');
      this._renderView('muthur');

      // If access was granted and there's a previous query, resubmit it automatically
      if (codeResult.includes('RESTRICTED DATA UNLOCKED') && this._lastMuthurQuery) {
        // Brief delay so user sees the "ACCESS GRANTED" message first
        setTimeout(() => this._sendMuthurMessage(this._lastMuthurQuery), 1500);
      }
      return;
    }

    // Track this as the last real query (not a code attempt)
    this._lastMuthurQuery = userMsg;

    // Ensure bridge exists
    this._ensureMuthurBridge();

    // Clear screen and show processing indicator
    this.chatHistory = [{ type: 'system', text: 'PROCESSING QUERY...' }];
    this._renderView('muthur');

    try {
      const reply = await this.muthurBridge.sendMessage(userMsg);
      // Show only the response
      this.chatHistory = [{ type: 'muthur', text: reply }];
      // Response received sound
      TerminalSFX.play('typeResponse');
    } catch (err) {
      this.chatHistory = [{
        type: 'system',
        text: 'ERROR: UNABLE TO REACH MU/TH/UR. COMMUNICATIONS FAILURE.'
      }];
      TerminalSFX.play('buzz');
      console.error('WY-Terminal | MU/TH/UR communication error:', err);
    }

    this._renderView('muthur');
  }

  /**
   * Handle a GM command forwarded from the MuthurEngine.
   */
  _handleEngineGmCommand(cmd) {
    switch (cmd.type) {
      case 'clear_screen':
        this.chatHistory = [];
        if (this.activeView === 'muthur') this._renderView('muthur');
        break;

      case 'plugin_switched':
        this.chatHistory = [{
          type: 'system',
          text: `SCENARIO SWITCHED TO: ${cmd.plugin?.toUpperCase() || 'UNKNOWN'}`
        }];
        if (this.activeView === 'muthur') this._renderView('muthur');
        break;

      case 'start_self_destruct':
        // When triggered via MuthurEngine GM command, use dialog for armed-by
        this._showSelfDestructDialog();
        break;

      case 'cancel_self_destruct':
        this._cancelSelfDestruct();
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
    const viewport = contentEl.querySelector('#wy-map-viewport');
    const img = contentEl.querySelector('#wy-map-img');
    if (!viewport || !img) return;

    // Setup pinch-zoom on map viewport
    const mapZoom = new PinchZoomHandler(viewport, img);
    this._mapZoom = mapZoom;

    // Zoom / reset buttons
    contentEl.querySelectorAll('[data-map-zoom]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.mapZoom;
        if (action === 'reset') {
          mapZoom.reset();
        } else if (action === 'in') {
          mapZoom.zoomIn();
        } else if (action === 'out') {
          mapZoom.zoomOut();
        }
      });
    });
  }

  /* ── Nav View Setup — star map canvas overlay ── */
  _setupNavView(contentEl) {
    const container = contentEl.querySelector('#wy-nav-starmap');
    const img = contentEl.querySelector('#wy-nav-starmap-img');
    const canvas = contentEl.querySelector('#wy-nav-starmap-overlay');
    if (!container || !img || !canvas) return;

    const drawRoute = () => {
      const w = img.naturalWidth || img.offsetWidth;
      const h = img.naturalHeight || img.offsetHeight;
      canvas.width = img.offsetWidth;
      canvas.height = img.offsetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const navData = this._getNavData();
      const route = navData.routePoints || [];
      const shipPos = navData.shipPos || { x: 0.5, y: 0.5 };

      // Draw route line
      if (route.length >= 2) {
        ctx.strokeStyle = 'rgba(127, 255, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        route.forEach((pt, i) => {
          const px = pt.x * canvas.width;
          const py = pt.y * canvas.height;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw waypoint dots
        route.forEach(pt => {
          const px = pt.x * canvas.width;
          const py = pt.y * canvas.height;
          ctx.fillStyle = 'rgba(127, 255, 0, 0.6)';
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
          if (pt.label) {
            ctx.fillStyle = 'rgba(127, 255, 0, 0.8)';
            ctx.font = '10px monospace';
            ctx.fillText(pt.label, px + 6, py - 6);
          }
        });
      }

      // Draw ship position (blinking dot)
      const sx = shipPos.x * canvas.width;
      const sy = shipPos.y * canvas.height;
      ctx.fillStyle = '#7fff00';
      ctx.shadowColor = '#7fff00';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Ship label
      ctx.fillStyle = '#7fff00';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('▲ SHIP', sx + 8, sy + 4);
    };

    if (img.complete) {
      drawRoute();
    } else {
      img.addEventListener('load', drawRoute);
    }

    // Pinch-zoom on star map
    const navZoom = new PinchZoomHandler(container, img);
    this._navZoom = navZoom;
    // Redraw overlay when zoom changes
    const origTransform = navZoom._applyTransform?.bind(navZoom);
    if (origTransform) {
      navZoom._applyTransform = (...args) => {
        origTransform(...args);
        // Sync canvas transform with image
        canvas.style.transform = img.style.transform;
      };
    }
  }

  /* ── Crew View Setup — List/Detail with clearance gate ── */
  _setupCrewView(contentEl) {
    const listView = contentEl.querySelector('#wy-crew-list-view');
    const detailView = contentEl.querySelector('#wy-crew-detail-view');
    
    // Cache crew data for detail lookup
    this._currentCrew = this._getCrewData();

    // Store which crew member was clicked
    let pendingCrewIndex = null;

    // [VIEW] button handler
    contentEl.querySelectorAll('[data-action="view-crew"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.crewIndex);
        pendingCrewIndex = idx;

        // GM bypasses command code
        if (game.user.isGM) {
          this._showCrewDetail(contentEl, idx);
          return;
        }

        // Check if current clearance grants crew access (MEDICAL or higher)
        const clearance = this._getActiveClearance();
        if (this._getClearanceRank(clearance) >= 1) {
          this._showCrewDetail(contentEl, idx);
          return;
        }

        // No clearance — show ACCESS DENIED (no keypad, player must use CMD CODE view)
        ui.notifications.warn('ACCESS DENIED — COMMAND CODE REQUIRED. Use the CMD CODE button to authorize.');
      });
    });

    // [CLOSE] button in detail view
    contentEl.querySelector('[data-action="close-crew"]')?.addEventListener('click', () => {
      detailView?.classList.add('wy-hidden');
      listView?.classList.remove('wy-hidden');
    });

    // GM: Save crew member edits (status & location)
    contentEl.querySelector('[data-action="save-crew-edit"]')?.addEventListener('click', async () => {
      if (!game.user.isGM || pendingCrewIndex == null) return;

      const newStatus = contentEl.querySelector('#wy-crew-edit-status')?.value || 'ACTIVE';
      const newLocation = contentEl.querySelector('#wy-crew-edit-location')?.value?.trim().toUpperCase() || 'UNKNOWN';

      // Load current roster (or copy defaults)
      let crew = this._loadSetting('crewRoster');
      if (!crew.length) {
        const profile = this._getShipProfile();
        crew = [...profile.defaultCrew];
      }

      if (!crew[pendingCrewIndex]) return;

      // Determine status class
      const statusClass = this._crewStatusToClass(newStatus);
      const statusTextClass = statusClass === 'online' ? 'wy-text-green' :
        statusClass === 'warning' ? 'wy-text-amber' : 'wy-text-red';

      crew[pendingCrewIndex] = {
        ...crew[pendingCrewIndex],
        status: newStatus,
        location: newLocation,
        statusClass,
        statusTextClass,
      };

      await game.settings.set('wy-terminal', 'crewRoster', crew);
      ui.notifications.info(`WY-Terminal: ${crew[pendingCrewIndex].name} updated — ${newStatus} / ${newLocation}`);

      // Refresh
      this._currentCrew = crew;
      this._broadcastSocket('refreshView', { view: 'crew' });
      this._showCrewDetail(contentEl, pendingCrewIndex);
    });
  }

  _showCrewDetail(contentEl, crewIndex) {
    const crew = this._currentCrew[crewIndex];
    if (!crew) return;

    const listView = contentEl.querySelector('#wy-crew-list-view');
    const detailView = contentEl.querySelector('#wy-crew-detail-view');

    // Populate detail
    const nameEl = contentEl.querySelector('#wy-crew-detail-name');
    const roleEl = contentEl.querySelector('#wy-crew-detail-role');
    const locationEl = contentEl.querySelector('#wy-crew-detail-location');
    const statusEl = contentEl.querySelector('#wy-crew-detail-status');
    const portraitEl = contentEl.querySelector('#wy-crew-detail-portrait');
    const detailBody = contentEl.querySelector('#wy-crew-detail-body');

    if (nameEl) nameEl.textContent = crew.name || 'UNKNOWN';
    if (roleEl) roleEl.textContent = crew.role || 'UNASSIGNED';
    if (locationEl) locationEl.textContent = crew.location || 'UNKNOWN';
    if (statusEl) {
      statusEl.textContent = crew.status || 'UNKNOWN';
      statusEl.className = `wy-crew-det-status-val ${crew.statusTextClass || ''}`;
    }

    // Try to pull portrait from Foundry actor
    if (portraitEl) {
      const actorImg = this._getCrewPortrait(crew.name);
      if (actorImg && actorImg !== 'icons/svg/mystery-man.svg') {
        portraitEl.src = actorImg;
        portraitEl.style.display = 'block';
      } else {
        portraitEl.style.display = 'none';
      }
    }

    // Additional detail text
    if (detailBody) {
      const lines = [];
      if (crew.bio) lines.push(crew.bio);
      if (crew.notes) lines.push(`\nNOTES:\n${crew.notes}`);
      if (crew.specialization) lines.push(`SPECIALIZATION: ${crew.specialization}`);
      detailBody.textContent = lines.join('\n') || 'NO ADDITIONAL PERSONNEL DATA ON FILE.';
    }

    // GM: populate edit fields with current crew member values
    if (game.user.isGM) {
      const editStatus = contentEl.querySelector('#wy-crew-edit-status');
      const editLocation = contentEl.querySelector('#wy-crew-edit-location');
      if (editStatus) editStatus.value = crew.status || 'ACTIVE';
      if (editLocation) {
        this._populateLocationDropdown(editLocation);
        editLocation.value = crew.location || 'UNKNOWN';
      }
    }

    listView?.classList.add('wy-hidden');
    detailView?.classList.remove('wy-hidden');
  }

  _getCrewPortrait(crewName) {
    // Search Foundry actors for matching character name
    if (!game.actors) return null;
    const name = (crewName || '').toUpperCase();
    const actor = game.actors.find(a => {
      const actorName = (a.name || '').toUpperCase();
      return actorName === name || actorName.includes(name) || name.includes(actorName);
    });
    return actor?.img || null;
  }

  /**
   * Map crew status string to a CSS indicator class.
   */
  _crewStatusToClass(status) {
    const s = (status || '').toUpperCase();
    if (['ACTIVE', 'ON DUTY'].includes(s)) return 'online';
    if (['OFF DUTY', 'RESTING', 'IN CRYO', 'INJURED', 'QUARANTINED', 'DETAINED'].includes(s)) return 'warning';
    if (['CRITICAL', 'MIA', 'KIA', 'UNKNOWN'].includes(s)) return 'critical';
    return 'online';
  }

  /**
   * Populate the GM location dropdown with ship-specific locations.
   */
  _populateLocationDropdown(selectEl) {
    const shipId = (game.settings.get('wy-terminal', 'activeShip') || 'montero').toLowerCase();
    selectEl.innerHTML = '';

    const UNIVERSAL = ['UNKNOWN', 'UMBILICAL', 'EXTERNAL'];

    const MONTERO = [
      'BRIDGE',
      'MEDLAB',
      'GALLERY',
      'CRYO',
    ];

    const CRONUS = [
      // DECK D
      '(DECK D) VEHICLE BAY',
      // DECK C
      '(DECK C) REACTOR',
      '(DECK C) JUNCTION C-2',
      '(DECK C) CARGO BAY 1',
      '(DECK C) CARGO BAY 2',
      '(DECK C) CARGO OFFICE',
      '(DECK C) JUNCTION C-1',
      '(DECK C) FORWARD',
      '(DECK C) AFT',
      // DECK B
      '(DECK B) BRIDGE',
      '(DECK B) JUNCTION B-1',
      '(DECK B) VESTIBULE 1',
      '(DECK B) VESTIBULE 2',
      '(DECK B) MESS HALL',
      '(DECK B) CORPORATE SUITE',
      '(DECK B) LIVING AREA',
      '(DECK B) JUNCTION B-2',
      '(DECK B) MEDLAB',
      '(DECK B) SCI LAB 2',
      '(DECK B) SCI LAB 1',
      '(DECK B) SCIENCE SECTOR',
      '(DECK B) FORWARD',
      '(DECK B) AFT',
      // DECK A
      '(DECK A) MU/TH/UR',
      '(DECK A) JUNCTION A-1',
      '(DECK A) EXAMINATION ROOM',
      '(DECK A) JUNCTION A-2',
      '(DECK A) CRYO SECTOR',
      '(DECK A) FORWARD',
      '(DECK A) AFT',
    ];

    // Helper to add an optgroup
    const addGroup = (label, items) => {
      const group = document.createElement('optgroup');
      group.label = label;
      items.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.textContent = loc;
        group.appendChild(opt);
      });
      selectEl.appendChild(group);
    };

    addGroup('GENERAL', UNIVERSAL);
    addGroup('MONTERO', MONTERO);
    addGroup('CRONUS — DECK D', CRONUS.filter(l => l.startsWith('(DECK D)')));
    addGroup('CRONUS — DECK C', CRONUS.filter(l => l.startsWith('(DECK C)')));
    addGroup('CRONUS — DECK B', CRONUS.filter(l => l.startsWith('(DECK B)')));
    addGroup('CRONUS — DECK A', CRONUS.filter(l => l.startsWith('(DECK A)')));
  }

  /* ══════════════════════════════════════════════════════════════
     CARGO VIEW — List / Detail / GM Add-Edit-Delete
     ══════════════════════════════════════════════════════════════ */
  _setupCargoView(contentEl) {
    this._currentCargo = this._getCargoData();
    this._editingCargoIdx = null;
    this._currentDetailCargo = null;

    const listView   = contentEl.querySelector('#wy-cargo-list-view');
    const detailView = contentEl.querySelector('#wy-cargo-detail-view');
    const form       = contentEl.querySelector('#wy-cargo-form');

    // ── [VIEW] detail ──
    contentEl.querySelectorAll('[data-action="view-cargo"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.cargoIdx, 10);
        const item = this._currentCargo[idx];
        if (!item) return;
        this._currentDetailCargo = { ...item, idx };
        this._showCargoDetail(contentEl, item);
        listView?.classList.add('wy-hidden');
        detailView?.classList.remove('wy-hidden');
      });
    });

    // ── [CLOSE] detail ──
    contentEl.querySelector('[data-action="close-cargo"]')?.addEventListener('click', () => {
      detailView?.classList.add('wy-hidden');
      listView?.classList.remove('wy-hidden');
      this._currentDetailCargo = null;
    });

    // ── GM: + ADD ITEM ──
    contentEl.querySelector('[data-action="add-cargo"]')?.addEventListener('click', () => {
      this._editingCargoIdx = null;
      const titleEl = contentEl.querySelector('#wy-cargo-form-title');
      if (titleEl) titleEl.textContent = 'ADD CARGO ITEM';
      contentEl.querySelector('#wy-cargo-form-name').value = '';
      contentEl.querySelector('#wy-cargo-form-qty').value = '1';
      contentEl.querySelector('#wy-cargo-form-category').value = 'EQUIPMENT';
      contentEl.querySelector('#wy-cargo-form-desc').value = '';
      form?.classList.remove('wy-hidden');
    });

    // ── GM: [EDIT] from detail ──
    contentEl.querySelector('[data-action="edit-cargo"]')?.addEventListener('click', () => {
      if (!this._currentDetailCargo) return;
      const item = this._currentDetailCargo;
      this._editingCargoIdx = item.idx;
      const titleEl = contentEl.querySelector('#wy-cargo-form-title');
      if (titleEl) titleEl.textContent = 'EDIT CARGO ITEM';
      contentEl.querySelector('#wy-cargo-form-name').value = item.name || '';
      contentEl.querySelector('#wy-cargo-form-qty').value = item.qty ?? 1;
      contentEl.querySelector('#wy-cargo-form-category').value = item.category || 'EQUIPMENT';
      const locSelect = contentEl.querySelector('#wy-cargo-form-location');
      if (locSelect) locSelect.value = item.location || 'UNKNOWN';
      contentEl.querySelector('#wy-cargo-form-desc').value = item.description || '';
      detailView?.classList.add('wy-hidden');
      form?.classList.remove('wy-hidden');
    });

    // ── GM: COMMIT (add or update) ──
    contentEl.querySelector('[data-action="submit-cargo"]')?.addEventListener('click', async () => {
      const name     = contentEl.querySelector('#wy-cargo-form-name')?.value?.trim().toUpperCase();
      const qty      = parseInt(contentEl.querySelector('#wy-cargo-form-qty')?.value, 10) || 1;
      const category = contentEl.querySelector('#wy-cargo-form-category')?.value || 'EQUIPMENT';
      const location = contentEl.querySelector('#wy-cargo-form-location')?.value || 'UNKNOWN';
      const description = contentEl.querySelector('#wy-cargo-form-desc')?.value?.trim() || '';
      if (!name) { ui.notifications.warn('Item name is required.'); return; }

      const cargo = [...this._currentCargo];
      const entry = { name, qty, category, location, description };

      if (this._editingCargoIdx !== null && this._editingCargoIdx < cargo.length) {
        cargo[this._editingCargoIdx] = entry;
        ui.notifications.info(`WY-Terminal: Updated ${name}`);
      } else {
        cargo.push(entry);
        ui.notifications.info(`WY-Terminal: Added ${name}`);
      }

      await game.settings.set('wy-terminal', 'cargoManifest', cargo);
      this._editingCargoIdx = null;
      form?.classList.add('wy-hidden');
      this._switchView('cargo');
      this._broadcastSocket('refreshView');
    });

    // ── GM: CANCEL form ──
    contentEl.querySelector('[data-action="cancel-cargo"]')?.addEventListener('click', () => {
      this._editingCargoIdx = null;
      form?.classList.add('wy-hidden');
    });

    // ── GM: [DEL] from detail ──
    contentEl.querySelector('[data-action="delete-cargo"]')?.addEventListener('click', async () => {
      if (!this._currentDetailCargo) return;
      const idx = this._currentDetailCargo.idx;
      const cargo = [...this._currentCargo];
      const removed = cargo.splice(idx, 1)[0];
      await game.settings.set('wy-terminal', 'cargoManifest', cargo);
      ui.notifications.info(`WY-Terminal: Removed ${removed?.name}`);
      this._currentDetailCargo = null;
      this._switchView('cargo');
      this._broadcastSocket('refreshView');
    });
  }

  /**
   * Populate cargo detail view elements.
   */
  _showCargoDetail(contentEl, item) {
    const nameEl  = contentEl.querySelector('#wy-cargo-detail-name');
    const badgeEl = contentEl.querySelector('#wy-cargo-detail-badge');
    const qtyEl   = contentEl.querySelector('#wy-cargo-detail-qty');
    const locEl   = contentEl.querySelector('#wy-cargo-detail-location');
    const bodyEl  = contentEl.querySelector('#wy-cargo-detail-body');

    if (nameEl)  nameEl.textContent = item.name;
    if (qtyEl)   qtyEl.textContent  = `QTY: ${item.qty}`;
    if (locEl)   locEl.textContent   = item.location || 'UNKNOWN';
    if (bodyEl)  bodyEl.textContent  = item.description || 'NO ADDITIONAL DATA ON FILE.';

    if (badgeEl) {
      badgeEl.textContent = item.category || 'EQUIPMENT';
      badgeEl.className = `wy-cargo-badge wy-cat-${item.category || 'EQUIPMENT'}`;
    }
  }

  /* ── Command Code View Setup ── */
  _setupCommandCodeView(contentEl) {
    const display = contentEl.querySelector('#wy-cc-keypad-display');
    let buffer = '';
    const MAX_DIGITS = 8;

    const updateDisplay = () => {
      if (display) display.textContent = buffer;
    };

    contentEl.querySelectorAll('[data-cc-keypad]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const val = btn.dataset.ccKeypad;

        if (val === 'clear') {
          buffer = '';
          updateDisplay();
          // Reset display style
          if (display) {
            display.style.color = '';
            display.style.borderColor = '';
          }
          return;
        }

        if (val === 'enter') {
          if (!buffer.length) return;

          // Validate code against stored command codes
          const codes = this._loadCommandCodes();
          const match = codes.find(c => c.code === buffer);

          if (match) {
            const role = (match.role || 'NONE').toUpperCase();
            const currentRank = this._getClearanceRank(this._getActiveClearance());
            const newRank = this._getClearanceRank(role);

            // Only upgrade clearance, never downgrade
            if (newRank > currentRank) {
              if (game.user.isGM) {
                await this._setActiveClearance(role);
              } else {
                // Players can't write world settings — ask GM via socket
                game.socket.emit('module.wy-terminal', {
                  type: 'setClearance',
                  payload: { level: role },
                });
              }
            }

            // Visual feedback — green flash
            if (display) {
              display.textContent = `ACCESS GRANTED — ${role}`;
              display.style.color = 'var(--wy-green)';
              display.style.borderColor = 'var(--wy-green)';
            }

            // Play sound if available
            this._playSound?.('keypad-accept');

            // Update footer clearance in the main app element
            this._updateFooterClearance(role);

            // Update the current clearance display in this view
            const valueEl = contentEl.querySelector('.wy-cc-current-value');
            if (valueEl) {
              // Remove old level class
              valueEl.className = valueEl.className.replace(/wy-cc-level-\S+/g, '');
              valueEl.classList.add(`wy-cc-level-${role}`);
              valueEl.textContent = role;
            }

            // Broadcast to other clients
            this._broadcastSocket?.('refreshView', { view: 'commandcode' });

            // Clear buffer after delay
            setTimeout(() => {
              buffer = '';
              updateDisplay();
              if (display) {
                display.style.color = '';
                display.style.borderColor = '';
              }
            }, 2000);
          } else {
            // Invalid code — red flash
            if (display) {
              display.textContent = 'ACCESS DENIED';
              display.style.color = 'var(--wy-red)';
              display.style.borderColor = 'var(--wy-red)';
            }

            this._playSound?.('keypad-deny');

            setTimeout(() => {
              buffer = '';
              updateDisplay();
              if (display) {
                display.style.color = '';
                display.style.borderColor = '';
              }
            }, 1500);
          }
          return;
        }

        // Digit input
        if (buffer.length < MAX_DIGITS) {
          buffer += val;
          updateDisplay();
        }
      });
    });

    // ── GM Command Code Management (only present in GM template) ──
    if (game.user.isGM) {
      // Set player clearance dropdown
      contentEl.querySelector('[data-action="set-clearance"]')?.addEventListener('change', async (e) => {
        const newLevel = e.target.value;
        await this._setActiveClearance(newLevel);
        ui.notifications.info(`WY-Terminal: Player clearance set to ${newLevel}.`);
        this._broadcastSocket('refreshView', { view: 'all' });
      });

      // Add code button
      contentEl.querySelector('[data-action="add-code"]')?.addEventListener('click', () => {
        const list = contentEl.querySelector('#wy-command-codes-list');
        if (!list) return;
        const idx = list.querySelectorAll('.wy-cmd-code-row').length;
        const autoCode = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
        const row = document.createElement('div');
        row.className = 'wy-setting-row wy-cmd-code-row';
        row.dataset.codeIndex = idx;
        row.innerHTML = `
          <input class="wy-setting-input" type="text" data-field="name" value="" placeholder="NAME" />
          <select class="wy-setting-input" data-field="role">
            <option value="MEDICAL">MEDICAL</option>
            <option value="CAPTAIN">CAPTAIN</option>
            <option value="CORPORATE">CORPORATE</option>
            <option value="MASTER_OVERRIDE">MASTER OVERRIDE</option>
          </select>
          <input class="wy-setting-input" type="text" data-field="code" value="${autoCode}" placeholder="CODE" maxlength="8" />
          <button class="wy-cmd-code-delete" data-action="remove-code" title="Remove">✕</button>
        `;
        row.querySelector('[data-action="remove-code"]').addEventListener('click', () => row.remove());
        list.appendChild(row);
      });

      // Remove code buttons
      contentEl.querySelectorAll('[data-action="remove-code"]').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.closest('.wy-cmd-code-row')?.remove();
        });
      });

      // Save codes button
      contentEl.querySelector('[data-action="save-codes"]')?.addEventListener('click', async () => {
        const rows = contentEl.querySelectorAll('.wy-cmd-code-row');
        const codes = [];
        rows.forEach(row => {
          const name = row.querySelector('[data-field="name"]')?.value?.trim().toUpperCase() || '';
          const role = row.querySelector('[data-field="role"]')?.value?.trim().toUpperCase() || '';
          const code = (row.querySelector('[data-field="code"]')?.value?.trim() || '').slice(0, 8);
          if (name && code) {
            codes.push({ name, role, code });
          }
        });
        await game.settings.set('wy-terminal', 'commandCodes', codes);
        ui.notifications.info(`WY-Terminal: ${codes.length} command code(s) saved.`);
      });
    }
  }

  /* ── Comms Frequency Keypad Setup ── */
  _setupCommsView(contentEl) {
    const display = contentEl.querySelector('#wy-freq-keypad-display');
    let buffer = '';
    // ###.## = 6 chars total (3 digits + dot + 2 digits)
    const MAX_CHARS = 6;

    const updateDisplay = () => {
      if (display) display.textContent = buffer ? `${buffer} MHz` : '';
    };

    contentEl.querySelectorAll('[data-freq-keypad]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const val = btn.dataset.freqKeypad;

        if (val === 'clear') {
          buffer = '';
          updateDisplay();
          if (display) {
            display.style.color = '';
            display.style.borderColor = '';
          }
          return;
        }

        if (val === 'enter') {
          if (!buffer.length) return;

          // Validate strict ###.## format
          const valid = /^\d{3}\.\d{2}$/.test(buffer);
          if (!valid) {
            if (display) {
              display.textContent = 'INVALID FORMAT';
              display.style.color = 'var(--wy-red)';
              display.style.borderColor = 'var(--wy-red)';
            }
            this._playSound?.('keypad-deny');
            setTimeout(() => {
              buffer = '';
              updateDisplay();
              if (display) {
                display.style.color = '';
                display.style.borderColor = '';
              }
            }, 1500);
            return;
          }

          // Save frequency — GM writes directly, player asks via socket
          if (game.user.isGM) {
            await game.settings.set('wy-terminal', 'commFrequency', buffer);
          } else {
            game.socket.emit('module.wy-terminal', {
              type: 'setCommFrequency',
              payload: { frequency: buffer },
            });
          }

          // Visual feedback — green flash
          if (display) {
            display.textContent = `FREQUENCY SET: ${buffer} MHz`;
            display.style.color = 'var(--wy-green)';
            display.style.borderColor = 'var(--wy-green)';
          }
          this._playSound?.('keypad-accept');

          // Broadcast refresh to all clients
          this._broadcastSocket('refreshView', { view: 'comms' });

          setTimeout(() => {
            buffer = '';
            updateDisplay();
            if (display) {
              display.style.color = '';
              display.style.borderColor = '';
            }
            this.render();
          }, 2000);
          return;
        }

        // Decimal point
        if (val === '.') {
          if (buffer.includes('.')) return;     // Only one decimal
          if (buffer.length === 0) return;      // Don't start with decimal
          if (buffer.length > 3) return;        // Decimal must be at position 1-3
          buffer += '.';
          updateDisplay();
          return;
        }

        // Digit input
        if (buffer.length < MAX_CHARS) {
          // Auto-insert decimal after 3rd digit if not already present
          if (buffer.length === 3 && !buffer.includes('.')) {
            buffer += '.';
          }
          // Enforce max 2 digits after decimal
          const dotIdx = buffer.indexOf('.');
          if (dotIdx !== -1 && buffer.length - dotIdx > 2) return;

          buffer += val;
          updateDisplay();
        }
      });
    });
  }

  /* ── Game Clock View Setup ── */
  _setupGameClockView(contentEl) {
    // Live-tick the clock display every second
    const dateEl = contentEl.querySelector('#wy-clock-date');
    const timeEl = contentEl.querySelector('#wy-clock-time');

    const tickClock = () => {
      const { dateStr, timeStr } = this._getGameClockDate();
      if (dateEl) dateEl.textContent = dateStr;
      if (timeEl) timeEl.textContent = timeStr;
    };
    this._clockInterval = setInterval(tickClock, 1000);

    // GM adjustment buttons
    if (game.user.isGM) {
      contentEl.querySelectorAll('[data-clock-adjust]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const unit = btn.dataset.clockAdjust;   // year, month, day, hour, minute
          const dir = parseInt(btn.dataset.clockDir, 10); // +1 or -1

          // Freeze the clock: compute current game time, then re-anchor
          const { date } = this._getGameClockDate();

          switch (unit) {
            case 'year':   date.setUTCFullYear(date.getUTCFullYear() + dir); break;
            case 'month':  date.setUTCMonth(date.getUTCMonth() + dir); break;
            case 'day':    date.setUTCDate(date.getUTCDate() + dir); break;
            case 'hour':   date.setUTCHours(date.getUTCHours() + dir); break;
            case 'minute': date.setUTCMinutes(date.getUTCMinutes() + dir); break;
          }

          // Save new epoch + re-anchor to now
          await game.settings.set('wy-terminal', 'gameClockEpoch', date.getTime());
          await game.settings.set('wy-terminal', 'gameClockRealAnchor', Date.now());

          tickClock();
          this._broadcastSocket('refreshView', { view: 'gameclock' });
        });
      });

      // Reset button
      const resetBtn = contentEl.querySelector('[data-clock-action="reset"]');
      if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
          await game.settings.set('wy-terminal', 'gameClockEpoch', Date.UTC(2183, 5, 12, 6, 0, 0));
          await game.settings.set('wy-terminal', 'gameClockRealAnchor', Date.now());
          tickClock();
          this._broadcastSocket('refreshView', { view: 'gameclock' });
          ui.notifications.info('WY-Terminal: Game clock reset to 2183-06-12 06:00.');
        });
      }
    }
  }

  /**
   * Clean up clock interval when leaving the view.
   */
  _clearClockInterval() {
    if (this._clockInterval) {
      clearInterval(this._clockInterval);
      this._clockInterval = null;
    }
  }

  /**
   * Dynamically update the footer clearance display without re-rendering.
   */
  _updateFooterClearance(level) {
    const el = this.element?.[0] || this.element;
    if (!el) return;
    const badge = el.querySelector('.wy-footer-clearance');
    if (!badge) return;
    badge.textContent = `CLEARANCE: ${level}`;
    badge.className = badge.className.replace(/wy-cc-level-\S+/g, '');
    badge.classList.add('wy-footer-clearance', `wy-cc-level-${level}`);
  }

  _loadCommandCodes() {
    try {
      const codes = game.settings.get('wy-terminal', 'commandCodes');
      return Array.isArray(codes) ? codes : [];
    } catch {
      return [];
    }
  }

  /* ── Clearance Level Helpers ── */
  static CLEARANCE_RANK = { 'NONE': 0, 'MEDICAL': 1, 'CAPTAIN': 2, 'CORPORATE': 3, 'MASTER_OVERRIDE': 4 };

  _getActiveClearance() {
    if (game.user.isGM) return 'MASTER_OVERRIDE';
    try {
      return game.settings.get('wy-terminal', 'activeClearanceLevel') || 'NONE';
    } catch { return 'NONE'; }
  }

  _getClearanceRank(level) {
    return WYTerminalApp.CLEARANCE_RANK[level] ?? 0;
  }

  async _setActiveClearance(level) {
    await game.settings.set('wy-terminal', 'activeClearanceLevel', level);
  }

  /**
   * Check if a log classification is accessible at the given clearance.
   * MEDICAL clearance → can view MEDICAL
   * CAPTAIN → all except SENSITIVE, RESTRICTED, CORPORATE
   * CORPORATE → everything
   * MASTER_OVERRIDE → everything, no codes needed
   */
  _canAccessClassification(classification, clearance) {
    if (!classification || classification === 'SYSTEM' || classification === 'MU/TH/UR') return true;
    const rank = this._getClearanceRank(clearance);
    if (rank >= 4) return true; // MASTER_OVERRIDE
    if (rank >= 3) return true; // CORPORATE sees all
    if (rank >= 2) {
      // CAPTAIN: blocked by SENSITIVE, RESTRICTED, CORPORATE
      return !['SENSITIVE', 'RESTRICTED', 'CORPORATE'].includes(classification);
    }
    if (rank >= 1) {
      // MEDICAL: only MEDICAL and unclassified
      return classification === 'MEDICAL';
    }
    // NONE: only unclassified
    return false;
  }

  /**
   * Determine required clearance level for a log classification.
   */
  _requiredClearanceFor(classification) {
    if (!classification || classification === 'SYSTEM' || classification === 'MU/TH/UR') return 'NONE';
    if (classification === 'MEDICAL') return 'MEDICAL';
    if (classification === 'PERSONAL') return 'CAPTAIN';
    if (['SENSITIVE', 'RESTRICTED', 'CORPORATE'].includes(classification)) return 'CORPORATE';
    return 'NONE';
  }

  /**
   * Check if user input is a valid command code in MU/TH/UR chat.
   * If matched with CORPORATE or MASTER_OVERRIDE, elevate clearance.
   * @param {string} input - uppercase user input
   * @returns {string|null} response text if code matched, null otherwise
   */
  async _tryCommandCodeInMuthur(input) {
    // Only check strings that look like command codes (8 digits)
    if (!/^\d{8}$/.test(input)) return null;

    const codes = this._loadCommandCodes();
    const match = codes.find(c => c.code === input);

    if (!match) {
      TerminalSFX.play('buzz');
      return 'INVALID COMMAND CODE.\nACCESS DENIED.';
    }

    const role = (match.role || 'NONE').toUpperCase();
    const rank = this._getClearanceRank(role);

    // Only CORPORATE (3) or MASTER_OVERRIDE (4) unlocks restricted data
    if (rank < 3) {
      TerminalSFX.play('buzz');
      return `COMMAND CODE ACCEPTED.\nCLEARANCE LEVEL: ${role}\n\nINSUFFICIENT CLEARANCE.\nCORPORATE OR MASTER OVERRIDE AUTHORIZATION REQUIRED.`;
    }

    // Elevate clearance
    const currentRank = this._getClearanceRank(this._getActiveClearance());
    if (rank > currentRank) {
      if (game.user.isGM) {
        await this._setActiveClearance(role);
      } else {
        game.socket.emit('module.wy-terminal', {
          type: 'setClearance',
          payload: { level: role },
        });
      }
      this._updateFooterClearance(role);
    }

    TerminalSFX.play('keypad-accept');

    // Reset AI conversation history to clear stale denial patterns
    if (this.muthurBridge?.engine) {
      this.muthurBridge.engine.resetConversation();
    }

    return `COMMAND CODE VERIFIED.\nAUTHORIZATION: ${role}\n\nACCESS GRANTED.\nRESTRICTED DATA UNLOCKED.\n\nENTER QUERY.`;
  }

  /* ── Status View Setup — Emergency Countdown Tickers ── */
  _setupStatusView(contentEl) {
    const status = this.shipStatus?.getStatus() ?? {};

    // Self-destruct countdown ticker
    if (status.selfDestructActive) {
      this._selfDestructInterval = setInterval(() => {
        const remaining = this._getSelfDestructRemainingMs();
        const countdownEl = contentEl.querySelector('#wy-sd-countdown');
        if (countdownEl) {
          countdownEl.textContent = `T-${this._formatCountdown(remaining)}`;
        }
        // If countdown reached zero, show DETONATION
        if (remaining <= 0) {
          this._clearSelfDestructInterval();
          if (countdownEl) {
            countdownEl.textContent = 'DETONATION';
            countdownEl.classList.add('wy-text-blink');
          }
        }
      }, 1000);
    }

    // GM cancel buttons for active emergencies
    if (game.user.isGM) {
      contentEl.querySelectorAll('[data-cancel-emergency]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = e.currentTarget.dataset.cancelEmergency;
          this._handleEmergencyAction(action);
        });
      });
    }
  }

  _clearSelfDestructInterval() {
    if (this._selfDestructInterval) {
      clearInterval(this._selfDestructInterval);
      this._selfDestructInterval = null;
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

    // Live-tick the emergency view countdown if self-destruct is active
    const status = this.shipStatus?.getStatus() ?? {};
    if (status.selfDestructActive) {
      this._selfDestructInterval = setInterval(() => {
        const remaining = this._getSelfDestructRemainingMs();
        const countdownEl = contentEl.querySelector('#wy-emergency-sd-timer');
        if (countdownEl) {
          countdownEl.textContent = `T-${this._formatCountdown(remaining)}`;
        }
        if (remaining <= 0) {
          this._clearSelfDestructInterval();
          if (countdownEl) {
            countdownEl.textContent = 'DETONATION';
            countdownEl.classList.add('wy-text-blink');
          }
        }
      }, 1000);
    }
  }

  _handleEmergencyAction(action) {
    // GM-only actions — show dialog for who triggered
    switch (action) {
      case 'self-destruct':
        if (game.user.isGM) {
          this._showSelfDestructDialog();
        } else {
          ui.notifications.warn('AUTHORIZATION REQUIRED — GM ACCESS ONLY');
        }
        break;
      case 'cancel-self-destruct':
        if (game.user.isGM) this._cancelSelfDestruct();
        break;
      case 'evacuate':
        if (game.user.isGM) {
          this._showEmergencyTriggerDialog('EVACUATION PROTOCOL', 'evacuate');
        } else {
          ui.notifications.warn('AUTHORIZATION REQUIRED — GM ACCESS ONLY');
        }
        break;
      case 'cancel-evacuate':
        if (game.user.isGM) this._cancelEmergency('evacuate');
        break;
      case 'lockdown':
        if (game.user.isGM) {
          this._showEmergencyTriggerDialog('SHIP LOCKDOWN', 'lockdown');
        } else {
          ui.notifications.warn('AUTHORIZATION REQUIRED — GM ACCESS ONLY');
        }
        break;
      case 'cancel-lockdown':
        if (game.user.isGM) this._cancelEmergency('lockdown');
        break;
      case 'distress':
        if (game.user.isGM) {
          this._showEmergencyTriggerDialog('DISTRESS SIGNAL', 'distress');
        } else {
          ui.notifications.warn('AUTHORIZATION REQUIRED — GM ACCESS ONLY');
        }
        break;
      case 'cancel-distress':
        if (game.user.isGM) this._cancelEmergency('distress');
        break;
      case 'purge':
        if (game.user.isGM) {
          this._showAtmospherePurgeDialog();
        } else {
          ui.notifications.warn('AUTHORIZATION REQUIRED — GM ACCESS ONLY');
        }
        break;
      case 'cancel-purge':
        if (game.user.isGM) this._cancelEmergency('purge');
        break;
    }
  }

  /**
   * Show a FoundryVTT dialog for GM to set who armed the self-destruct
   * and optional countdown duration (default 10 game hours).
   */
  _showSelfDestructDialog() {
    const crew = this._getCrewData();
    const crewOptions = crew.map(c => `<option value="${c.name}">${c.name.toUpperCase()}</option>`).join('');

    const content = `
      <form style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="font-weight: bold;">ARMED BY:</label>
          <select name="armedBy" style="width: 100%; margin-top: 4px;">
            <option value="">-- SELECT CREW MEMBER --</option>
            ${crewOptions}
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </div>
        <div>
          <label style="font-weight: bold;">COUNTDOWN (HOURS):</label>
          <input type="number" name="hours" value="10" min="0" max="99" step="1"
                 style="width: 100%; margin-top: 4px;" />
          <p class="notes" style="margin-top: 2px; font-size: 11px;">
            Game-time hours (10:1 acceleration applies).
          </p>
        </div>
      </form>
    `;

    new Dialog({
      title: '⚠ ARM SELF-DESTRUCT SEQUENCE',
      content,
      buttons: {
        arm: {
          label: 'ARM SELF-DESTRUCT',
          icon: '<i class="fas fa-radiation"></i>',
          callback: (html) => {
            const armedBy = html.find('[name="armedBy"]').val() || 'UNKNOWN';
            const hours = parseFloat(html.find('[name="hours"]').val()) || 10;
            this._armSelfDestruct(armedBy, hours);
          },
        },
        cancel: {
          label: 'ABORT',
          icon: '<i class="fas fa-times"></i>',
        },
      },
      default: 'cancel',
    }).render(true);
  }

  /**
   * Arm self-destruct with real countdown tracking.
   * @param {string} armedBy — Name of crew member who armed the sequence
   * @param {number} hours — Countdown duration in game hours
   */
  _armSelfDestruct(armedBy, hours) {
    const durationMs = hours * 60 * 60 * 1000; // game-time ms
    const armedAtReal = Date.now(); // real-world anchor for countdown

    this.shipStatus?.update({
      selfDestructActive: true,
      selfDestructArmedBy: armedBy.toUpperCase(),
      selfDestructArmedAtReal: armedAtReal,
      selfDestructDurationMs: durationMs,
      selfDestructTimer: null, // legacy field, no longer used
    });

    // Create log entry
    const timerStr = `${String(Math.floor(hours)).padStart(2, '0')}:00:00`;
    this._addLog(
      'EMERGENCY',
      `SELF-DESTRUCT SEQUENCE ARMED BY: ${armedBy.toUpperCase()}`,
      'critical',
      `Self-destruct countdown initiated. T-${timerStr}. All personnel advised to evacuate immediately.`,
    );

    // Show persistent alert on all clients
    this.showAlert('SELF-DESTRUCT SEQUENCE INITIATED', 0);
    this._broadcastSocket('emergencyActivated', {
      protocol: 'self-destruct',
      message: 'SELF-DESTRUCT SEQUENCE INITIATED',
      triggeredBy: armedBy.toUpperCase(),
    });

    // Broadcast refreshes so player status/emergency views update + logs flash
    this._broadcastSocket('refreshView', { view: 'status' });
    this._broadcastSocket('refreshView', { view: 'emergency' });
    this._broadcastSocket('newLogAlert', {});

    this.refreshCurrentView();
  }

  /**
   * Cancel the self-destruct sequence.
   */
  _cancelSelfDestruct() {
    const status = this.shipStatus?.getStatus() ?? {};
    const armedBy = status.selfDestructArmedBy || 'UNKNOWN';

    this.shipStatus?.update({
      selfDestructActive: false,
      selfDestructArmedBy: null,
      selfDestructArmedAtReal: null,
      selfDestructDurationMs: null,
      selfDestructTimer: null,
    });

    // Create log entry
    this._addLog(
      'EMERGENCY',
      'SELF-DESTRUCT SEQUENCE CANCELLED',
      'warning',
      `Self-destruct sequence (armed by ${armedBy}) has been aborted.`,
    );

    // Check if any emergencies remain active
    const updatedStatus = this.shipStatus?.getStatus() ?? {};
    const anyRemaining = updatedStatus.evacuationActive || updatedStatus.lockdownActive ||
      updatedStatus.distressActive || updatedStatus.purgeActive;
    if (!anyRemaining) this.hideAlert();

    this._broadcastSocket('emergencyCancelled', { protocol: 'self-destruct', anyRemaining });
    this._broadcastSocket('refreshView', { view: 'status' });
    this._broadcastSocket('refreshView', { view: 'emergency' });
    this._broadcastSocket('newLogAlert', {});

    this.refreshCurrentView();
  }

  /**
   * Compute remaining self-destruct countdown in ms.
   * Uses real-time anchor × 10 acceleration to match game clock.
   * Returns 0 if expired or not active.
   */
  _getSelfDestructRemainingMs() {
    const status = this.shipStatus?.getStatus() ?? {};
    if (!status.selfDestructActive) return 0;

    const armedAtReal = status.selfDestructArmedAtReal || 0;
    const durationMs = status.selfDestructDurationMs || 0;
    if (!armedAtReal || !durationMs) return 0;

    // Game-time elapsed = real elapsed × 10
    const realElapsed = Math.max(0, Date.now() - armedAtReal);
    const gameElapsed = realElapsed * 10;
    const remaining = Math.max(0, durationMs - gameElapsed);
    return remaining;
  }

  /**
   * Format milliseconds as HH:MM:SS countdown string.
   */
  _formatCountdown(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     UNIFIED EMERGENCY PROTOCOL METHODS
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Emergency protocol config — maps action key → display info + shipStatus keys.
   */
  static EMERGENCY_PROTOCOLS = {
    evacuate: {
      label: 'EVACUATION PROTOCOL',
      sender: 'EMERGENCY',
      logArm: 'EVACUATION PROTOCOL ACTIVATED',
      logCancel: 'EVACUATION PROTOCOL CANCELLED',
      alertMessage: 'EVACUATION PROTOCOL — ALL PERSONNEL REPORT TO ESCAPE PODS',
      level: 'critical',
      activeKey: 'evacuationActive',
      triggeredByKey: 'evacuationTriggeredBy',
      icon: 'fa-running',
    },
    lockdown: {
      label: 'SHIP LOCKDOWN',
      sender: 'SECURITY',
      logArm: 'SHIP LOCKDOWN INITIATED — ALL AIRLOCKS SEALED',
      logCancel: 'SHIP LOCKDOWN LIFTED — DOORS UNSEALED',
      alertMessage: 'SHIP LOCKDOWN — ALL DOORS SEALED',
      level: 'warning',
      activeKey: 'lockdownActive',
      triggeredByKey: 'lockdownTriggeredBy',
      icon: 'fa-lock',
    },
    distress: {
      label: 'DISTRESS SIGNAL',
      sender: 'COMMS',
      logArm: 'DISTRESS SIGNAL BROADCAST ON ALL FREQUENCIES',
      logCancel: 'DISTRESS SIGNAL BROADCAST TERMINATED',
      alertMessage: 'DISTRESS SIGNAL BROADCASTING ON ALL FREQUENCIES',
      level: 'critical',
      activeKey: 'distressActive',
      triggeredByKey: 'distressTriggeredBy',
      icon: 'fa-satellite-dish',
    },
    purge: {
      label: 'ATMOSPHERE PURGE',
      sender: 'EMERGENCY',
      logArm: 'ATMOSPHERE PURGE INITIATED',
      logCancel: 'ATMOSPHERE PURGE CANCELLED — REPRESSURIZATION IN PROGRESS',
      alertMessage: 'ATMOSPHERE PURGE IN PROGRESS',
      level: 'critical',
      activeKey: 'purgeActive',
      triggeredByKey: 'purgeTriggeredBy',
      targetKey: 'purgeTarget',
      icon: 'fa-wind',
    },
  };

  /**
   * Show a generic GM dialog for triggering an emergency protocol.
   * @param {string} title — Dialog title
   * @param {string} protocolKey — Key into EMERGENCY_PROTOCOLS
   */
  _showEmergencyTriggerDialog(title, protocolKey) {
    const crew = this._getCrewData();
    const crewOptions = crew.map(c => `<option value="${c.name}">${c.name.toUpperCase()}</option>`).join('');

    const content = `
      <form style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="font-weight: bold;">TRIGGERED BY:</label>
          <select name="triggeredBy" style="width: 100%; margin-top: 4px;">
            <option value="">-- SELECT CREW MEMBER --</option>
            ${crewOptions}
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </div>
      </form>
    `;

    const proto = WYTerminalApp.EMERGENCY_PROTOCOLS[protocolKey];

    new Dialog({
      title: `⚠ ${title}`,
      content,
      buttons: {
        activate: {
          label: `ACTIVATE ${title}`,
          icon: `<i class="fas ${proto?.icon || 'fa-exclamation-triangle'}"></i>`,
          callback: (html) => {
            const triggeredBy = html.find('[name="triggeredBy"]').val() || 'UNKNOWN';
            this._activateEmergency(protocolKey, triggeredBy);
          },
        },
        cancel: {
          label: 'ABORT',
          icon: '<i class="fas fa-times"></i>',
        },
      },
      default: 'cancel',
    }).render(true);
  }

  /**
   * Activate a generic emergency protocol.
   * @param {string} protocolKey — 'evacuate' | 'lockdown' | 'distress' | 'purge'
   * @param {string} triggeredBy — Crew member name
   * @param {string} [target] — For purge: deck/ship target
   */
  _activateEmergency(protocolKey, triggeredBy, target = '') {
    const proto = WYTerminalApp.EMERGENCY_PROTOCOLS[protocolKey];
    if (!proto) return;

    const updates = {
      [proto.activeKey]: true,
      [proto.triggeredByKey]: triggeredBy.toUpperCase(),
    };
    if (proto.targetKey && target) {
      updates[proto.targetKey] = target.toUpperCase();
    }
    this.shipStatus?.update(updates);

    // Log entry
    const logSubject = target
      ? `${proto.logArm} — ${target.toUpperCase()}`
      : `${proto.logArm} BY: ${triggeredBy.toUpperCase()}`;
    const logDetail = target
      ? `${proto.label} initiated by ${triggeredBy.toUpperCase()}. Target: ${target.toUpperCase()}.`
      : `${proto.label} initiated by ${triggeredBy.toUpperCase()}.`;
    this._addLog(proto.sender, logSubject, proto.level, logDetail);

    // Alert
    const alertMsg = target
      ? `${proto.alertMessage} — ${target.toUpperCase()}`
      : proto.alertMessage;
    this.showAlert(alertMsg, 0);
    this._broadcastSocket('emergencyActivated', {
      protocol: protocolKey,
      message: alertMsg,
      triggeredBy: triggeredBy.toUpperCase(),
      target: target.toUpperCase(),
    });

    // Broadcast refreshes
    this._broadcastSocket('refreshView', { view: 'status' });
    this._broadcastSocket('refreshView', { view: 'emergency' });
    this._broadcastSocket('newLogAlert', {});

    this.refreshCurrentView();
  }

  /**
   * Cancel a generic emergency protocol.
   * @param {string} protocolKey — 'evacuate' | 'lockdown' | 'distress' | 'purge'
   */
  _cancelEmergency(protocolKey) {
    const proto = WYTerminalApp.EMERGENCY_PROTOCOLS[protocolKey];
    if (!proto) return;

    const status = this.shipStatus?.getStatus() ?? {};
    const triggeredBy = status[proto.triggeredByKey] || 'UNKNOWN';
    const target = proto.targetKey ? (status[proto.targetKey] || '') : '';

    const updates = {
      [proto.activeKey]: false,
      [proto.triggeredByKey]: null,
    };
    if (proto.targetKey) updates[proto.targetKey] = null;
    this.shipStatus?.update(updates);

    // Log entry
    const logSubject = target
      ? `${proto.logCancel} — ${target}`
      : proto.logCancel;
    this._addLog(proto.sender, logSubject, 'info',
      `${proto.label} (triggered by ${triggeredBy}) has been cancelled.`);

    // Check if any emergencies remain active
    const updatedStatus = this.shipStatus?.getStatus() ?? {};
    const anyRemaining = updatedStatus.selfDestructActive || updatedStatus.evacuationActive ||
      updatedStatus.lockdownActive || updatedStatus.distressActive || updatedStatus.purgeActive;
    if (!anyRemaining) this.hideAlert();

    this._broadcastSocket('emergencyCancelled', { protocol: protocolKey, anyRemaining });
    this._broadcastSocket('refreshView', { view: 'status' });
    this._broadcastSocket('refreshView', { view: 'emergency' });
    this._broadcastSocket('newLogAlert', {});

    this.refreshCurrentView();
  }

  /**
   * Show atmosphere purge dialog with deck selection.
   */
  _showAtmospherePurgeDialog() {
    const crew = this._getCrewData();
    const crewOptions = crew.map(c => `<option value="${c.name}">${c.name.toUpperCase()}</option>`).join('');

    // Build deck options based on active ship
    const shipId = game.settings.get('wy-terminal', 'activeShip') || 'montero';
    let deckOptions = '<option value="ENTIRE SHIP">ENTIRE SHIP</option>';
    if (shipId === 'cronus') {
      deckOptions += `
        <option value="DECK A">DECK A — COMMAND / CRYO</option>
        <option value="DECK B">DECK B — CREW / SCIENCE</option>
        <option value="DECK C">DECK C — ENGINEERING / CARGO</option>
        <option value="DECK D">DECK D — VEHICLE BAY</option>
      `;
    }

    const content = `
      <form style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="font-weight: bold;">TRIGGERED BY:</label>
          <select name="triggeredBy" style="width: 100%; margin-top: 4px;">
            <option value="">-- SELECT CREW MEMBER --</option>
            ${crewOptions}
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </div>
        <div>
          <label style="font-weight: bold;">PURGE TARGET:</label>
          <select name="purgeTarget" style="width: 100%; margin-top: 4px;">
            ${deckOptions}
          </select>
        </div>
      </form>
    `;

    new Dialog({
      title: '⚠ ATMOSPHERE PURGE',
      content,
      buttons: {
        activate: {
          label: 'INITIATE PURGE',
          icon: '<i class="fas fa-wind"></i>',
          callback: (html) => {
            const triggeredBy = html.find('[name="triggeredBy"]').val() || 'UNKNOWN';
            const target = html.find('[name="purgeTarget"]').val() || 'ENTIRE SHIP';
            this._activateEmergency('purge', triggeredBy, target);
          },
        },
        cancel: {
          label: 'ABORT',
          icon: '<i class="fas fa-times"></i>',
        },
      },
      default: 'cancel',
    }).render(true);
  }

  /**
   * Flash the STATUS nav button on player terminals until clicked.
   * Called via socket from GM when emergency is activated.
   */
  _flashStatusButton() {
    if (game.user.isGM) return;
    const el = this.element?.[0] ?? this.element;
    const statusBtn = el?.querySelector('[data-view="status"]');
    if (statusBtn && !statusBtn.classList.contains('wy-nav-flash-red')) {
      statusBtn.classList.add('wy-nav-flash-red');
    }
  }

  /**
   * Start the self-destruct computer voice warning system.
   * Speaks a warning every 60 real seconds on player clients.
   */
  _startSelfDestructVoice() {
    if (game.user?.isGM) return;
    this._clearSelfDestructVoice();

    // Immediate first warning
    this._speakWarning('WARNING. SELF-DESTRUCT SEQUENCE HAS BEEN INITIATED. EVACUATE IMMEDIATELY.');

    // Repeat every 60 real seconds
    this._selfDestructVoiceInterval = setInterval(() => {
      const remaining = this._getSelfDestructRemainingMs();
      if (remaining <= 0) {
        this._speakWarning('DETONATION IMMINENT.');
        this._clearSelfDestructVoice();
        return;
      }
      const totalSec = Math.floor(remaining / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      let timeAnnounce = '';
      if (h > 0) timeAnnounce += `${h} hour${h > 1 ? 's' : ''} `;
      if (m > 0) timeAnnounce += `${m} minute${m > 1 ? 's' : ''}`;
      if (!timeAnnounce) timeAnnounce = 'less than one minute';
      this._speakWarning(`WARNING. SELF-DESTRUCT IN ${timeAnnounce.trim()}. ALL PERSONNEL EVACUATE IMMEDIATELY.`);
    }, 60000);
  }

  /**
   * Stop the self-destruct voice warning interval.
   */
  _clearSelfDestructVoice() {
    if (this._selfDestructVoiceInterval) {
      clearInterval(this._selfDestructVoiceInterval);
      this._selfDestructVoiceInterval = null;
    }
  }

  /**
   * Speak a warning using the Web Speech API.
   * Uses a robotic/low pitch voice for computer effect.
   */
  _speakWarning(text) {
    if (game.user?.isGM) return;
    try {
      if (!game.settings.get('wy-terminal', 'soundEnabled')) return;
    } catch { /* default enabled */ }

    if (!('speechSynthesis' in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 0.3;
    utterance.volume = 0.8;

    // Prefer a robotic-sounding voice if available
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      /microsoft|zira|david|mark|google/i.test(v.name) && v.lang.startsWith('en')
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    speechSynthesis.cancel(); // Stop any in-progress speech
    speechSynthesis.speak(utterance);
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
      if (this.activeView === 'muthur') this._renderView('muthur');
      ui.notifications.info('WY-Terminal: Chat log cleared.');
    });

    // Reset logs to defaults — clears all runtime/player-generated log entries
    contentEl.querySelector('[data-action="reset-logs"]')?.addEventListener('click', async () => {
      await game.settings.set('wy-terminal', 'logEntries', []);
      // Reload file logs to refresh the default flag cache
      await this._loadFileLogEntries();
      ui.notifications.info('WY-Terminal: Logs reset to defaults. All player/runtime entries removed.');
      this.refreshCurrentView();
    });

    // Ship profile switch — apply profile defaults to settings
    contentEl.querySelector('[data-action="switch-ship"]')?.addEventListener('click', async () => {
      const select = contentEl.querySelector('[data-setting="activeShip"]');
      if (!select) return;
      const newShipId = select.value;
      const profile = getShipProfile(newShipId);
      const oldShipId = game.settings.get('wy-terminal', 'activeShip');

      if (newShipId === oldShipId) {
        ui.notifications.warn('WY-Terminal: Already configured for this ship.');
        return;
      }

      // Save ship profile selection
      await game.settings.set('wy-terminal', 'activeShip', newShipId);

      // Apply profile defaults to ship identity settings
      await game.settings.set('wy-terminal', 'shipName', profile.name);
      await game.settings.set('wy-terminal', 'shipClass', profile.shipClass);
      await game.settings.set('wy-terminal', 'shipRegistry', profile.registry);
      await game.settings.set('wy-terminal', 'missionName', profile.mission);

      // Reset ship systems, crew, logs, and cargo to new profile defaults
      await game.settings.set('wy-terminal', 'shipSystems', []);
      await game.settings.set('wy-terminal', 'crewRoster', []);
      await game.settings.set('wy-terminal', 'logEntries', []);
      await game.settings.set('wy-terminal', 'cargoManifest', []);

      // Auto-switch scenario plugin to match ship profile
      if (profile.defaultPlugin) {
        await game.settings.set('wy-terminal', 'muthurPlugin', profile.defaultPlugin);
        if (this.muthurBridge?.engine) {
          try {
            await this.muthurBridge.engine.switchPlugin(profile.defaultPlugin);
          } catch (e) {
            console.warn('WY-Terminal | Plugin switch on ship change failed:', e);
          }
        }
      }

      // Reload file logs for the new ship profile
      await this._loadFileLogEntries();

      ui.notifications.info(`WY-Terminal: Ship switched to ${profile.name}. Systems, crew, and logs reset to defaults.`);

      // Broadcast to all clients so player terminals refresh
      this._broadcastSocket('shipSwitch', { shipId: newShipId, shipName: profile.name });
      this.render(true);
    });

    // Save navigation data
    contentEl.querySelector('[data-action="save-nav"]')?.addEventListener('click', async () => {
      const navInputs = contentEl.querySelectorAll('[data-nav]');
      const navData = this._loadSetting('navData') || {};
      navInputs.forEach(input => {
        const field = input.dataset.nav;
        navData[field] = input.value.trim();
      });
      await game.settings.set('wy-terminal', 'navData', navData);
      ui.notifications.info('WY-Terminal: Navigation data saved.');
      // Broadcast refresh so player terminals update
      this._broadcastSocket('refreshView', { view: 'nav' });
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

  /**
   * Return the current in-game date/time as "YYYY-MM-DD HH:MM".
   * Uses the Game Clock setting with 10:1 acceleration
   * (10 game-minutes per 1 real-world minute).
   */
  _getGameDate() {
    return this._getGameClockDate().formatted;
  }

  /**
   * Compute the current game clock Date object + formatted strings.
   * Clock auto-advances at 10× real time from anchor.
   */
  _getGameClockDate() {
    try {
      let epoch = game.settings.get('wy-terminal', 'gameClockEpoch');
      let anchor = game.settings.get('wy-terminal', 'gameClockRealAnchor');
      if (!epoch) epoch = Date.UTC(2183, 5, 12, 6, 0, 0);
      if (!anchor) anchor = Date.now();

      // Elapsed real-world ms since anchor, ×10 for game time
      const realElapsed = Math.max(0, Date.now() - anchor);
      const gameElapsed = realElapsed * 10;

      const d = new Date(epoch + gameElapsed);
      const pad = (n) => String(n).padStart(2, '0');
      const formatted = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
      const dateStr = `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()}`;
      const timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
      return { date: d, formatted, dateStr, timeStr };
    } catch (e) {
      return { date: new Date(Date.UTC(2183, 5, 12, 6, 0, 0)), formatted: '2183-06-12 06:00', dateStr: '06/12/2183', timeStr: '06:00' };
    }
  }

  /**
   * Get data for the game clock template.
   */
  _getGameClockDisplayData() {
    const { dateStr, timeStr } = this._getGameClockDate();
    return { clockDate: dateStr, clockTime: timeStr, isGM: game.user.isGM };
  }

  _getDisplayTitle() {
    const titles = {
      boot: 'SYSTEM BOOT',
      status: 'SHIP STATUS',
      crew: 'CREW MANIFEST',
      systems: 'SYSTEMS DIAGNOSTIC',
      logs: 'SHIP LOG',
      muthur: 'MU/TH/UR INTERFACE',
      scenes: 'SHIP SCHEMATICS',
      maps: 'DIGITAL MAPS',
      emergency: 'EMERGENCY PROTOCOLS',
      nav: 'NAVIGATION',
      comms: 'COMMUNICATIONS',
      cargo: 'CARGO MANIFEST',
      weapons: 'WEAPONS SYSTEMS',
      science: 'SCIENCE POD',
      settings: 'CONFIGURATION',
      commandcode: 'COMMAND CODE AUTHORIZATION',
      gameclock: 'GAME CLOCK',
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

  async _addLog(sender, subject, level = '', detail = '', mediaType = 'text', mediaUrl = '', timestamp = '', classification = '') {
    const logs = this._loadSetting('logEntries');
    const id = `rt-${Date.now()}`;
    logs.unshift({
      id,
      timestamp: timestamp || this._getGameDate(),
      sender: sender.toUpperCase(),
      subject: subject.toUpperCase(),
      level,
      detail: detail || subject.toUpperCase(),
      mediaType: mediaType || 'text',
      mediaUrl: mediaUrl || '',
      classification: (classification || '').toUpperCase(),
    });
    // Keep last 200 entries
    if (logs.length > 200) logs.length = 200;
    await game.settings.set('wy-terminal', 'logEntries', logs);
  }

  _broadcastSocket(type, payload) {
    game.socket.emit('module.wy-terminal', { type, payload });
  }
}
