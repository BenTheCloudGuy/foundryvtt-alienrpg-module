/**
 * ShipStatusManager — Manages the ship's status data as JSON.
 * Reads/writes status files that MuthurGPT can reference.
 * Broadcasts updates to all connected clients via Foundry sockets.
 */

export class ShipStatusManager {

  /** @type {Object} Current ship status data */
  _status = {};

  /** @type {string} Path for status files */
  _statusPath = '';

  constructor() {
    this._statusPath = game.settings.get('wy-terminal', 'statusPath') || 'modules/wy-terminal/status';
    this._load();
  }

  /* ══════════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Get the full current status object.
   * @returns {Object}
   */
  getStatus() {
    return { ...this._status };
  }

  /**
   * Get a specific status key.
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  get(key, fallback = null) {
    return this._status[key] ?? fallback;
  }

  /**
   * Update one or more status keys.
   * Persists to settings and broadcasts to other clients.
   * @param {Object} updates - Key/value pairs to merge
   */
  async update(updates) {
    Object.assign(this._status, updates);
    await this._save();
    this._broadcast(updates);
  }

  /**
   * Replace the entire status object (from a loaded file).
   * @param {Object} data
   */
  async load(data) {
    this._status = { ...data };
    await this._save();
  }

  /**
   * Merge updates received from another client via socket.
   * @param {Object} payload
   */
  mergeRemoteUpdate(payload) {
    Object.assign(this._status, payload);
  }

  /**
   * Reload status from the persisted setting.
   */
  reload() {
    this._load();
  }

  /* ══════════════════════════════════════════════════════════════════
     CREW MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Update a crew member's data.
   * @param {string} name
   * @param {Object} updates - e.g. { location: 'MEDBAY', status: 'INJURED' }
   */
  async updateCrewMember(name, updates) {
    let crew = game.settings.get('wy-terminal', 'crewRoster') || [];
    const idx = crew.findIndex(c => c.name === name.toUpperCase());
    if (idx >= 0) {
      crew[idx] = { ...crew[idx], ...updates };

      // Update status classes based on status text
      const status = (crew[idx].status || '').toUpperCase();
      if (status === 'ACTIVE' || status === 'ALIVE') {
        crew[idx].statusClass = 'online';
        crew[idx].statusTextClass = 'wy-text-green';
      } else if (status === 'INJURED' || status === 'STRESSED') {
        crew[idx].statusClass = 'warning';
        crew[idx].statusTextClass = 'wy-text-amber';
      } else if (status === 'CRITICAL' || status === 'DEAD' || status === 'MIA') {
        crew[idx].statusClass = 'critical';
        crew[idx].statusTextClass = 'wy-text-red';
      } else {
        crew[idx].statusClass = 'offline';
        crew[idx].statusTextClass = 'wy-text-dim';
      }

      await game.settings.set('wy-terminal', 'crewRoster', crew);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SYSTEM MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Update a ship system's status.
   * @param {string} systemName
   * @param {Object} updates - e.g. { status: 'OFFLINE', detail: 'DAMAGE SUSTAINED' }
   */
  async updateSystem(systemName, updates) {
    let systems = game.settings.get('wy-terminal', 'shipSystems') || [];
    const idx = systems.findIndex(s => s.name === systemName.toUpperCase());
    if (idx >= 0) {
      systems[idx] = { ...systems[idx], ...updates };

      // Update status class
      const status = (systems[idx].status || '').toUpperCase();
      if (status === 'ONLINE' || status === 'NOMINAL') {
        systems[idx].statusClass = 'online';
      } else if (status === 'WARNING' || status === 'DEGRADED') {
        systems[idx].statusClass = 'warning';
      } else if (status === 'OFFLINE' || status === 'CRITICAL' || status === 'DESTROYED') {
        systems[idx].statusClass = 'critical';
      } else {
        systems[idx].statusClass = 'offline';
      }

      await game.settings.set('wy-terminal', 'shipSystems', systems);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     LOG MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Add a new log entry.
   * @param {string} source
   * @param {string} message
   * @param {string} level - '', 'warning', or 'critical'
   */
  async addLog(source, message, level = '') {
    const logs = game.settings.get('wy-terminal', 'logEntries') || [];
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    logs.unshift({
      timestamp,
      source: source.toUpperCase(),
      message: message.toUpperCase(),
      level,
    });

    if (logs.length > 200) logs.length = 200;
    await game.settings.set('wy-terminal', 'logEntries', logs);
  }

  /* ══════════════════════════════════════════════════════════════════
     MAP MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Add a map to the terminal's map viewer.
   * @param {string} id - Unique identifier
   * @param {string} name - Display name
   * @param {string} img - Image path (relative to Foundry data)
   */
  async addMap(id, name, img) {
    const maps = game.settings.get('wy-terminal', 'maps') || [];
    const existing = maps.findIndex(m => m.id === id);
    if (existing >= 0) {
      maps[existing] = { id, name: name.toUpperCase(), img };
    } else {
      maps.push({ id, name: name.toUpperCase(), img });
    }
    await game.settings.set('wy-terminal', 'maps', maps);
  }

  /**
   * Remove a map.
   * @param {string} id
   */
  async removeMap(id) {
    let maps = game.settings.get('wy-terminal', 'maps') || [];
    maps = maps.filter(m => m.id !== id);
    await game.settings.set('wy-terminal', 'maps', maps);
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS FILE I/O — For MuthurGPT integration
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Export current status to a JSON file that MuthurGPT can read.
   * Creates a file in the configured status path.
   */
  async exportStatusFile() {
    const data = this._buildExportData();
    const json = JSON.stringify(data, null, 2);
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
    const filename = `ship_status_${ts}.json`;
    const path = `${this._statusPath}/${filename}`;

    try {
      // Use Foundry's FilePicker to save
      const file = new File([json], filename, { type: 'application/json' });
      await FilePicker.upload('data', this._statusPath, file, {});
      console.log(`WY-Terminal | Status exported to ${path}`);
      return path;
    } catch (err) {
      console.error('WY-Terminal | Failed to export status file:', err);
      throw err;
    }
  }

  /**
   * Import status from a JSON file (e.g., a MuthurGPT save file).
   * @param {string} path - Path to the JSON file
   */
  async importStatusFile(path) {
    try {
      const response = await fetch(path);
      const data = await response.json();

      // Handle MuthurGPT save file format
      if (data.saved_config) {
        this._importMuthurSave(data.saved_config);
      } else {
        await this.load(data);
      }

      console.log(`WY-Terminal | Status imported from ${path}`);
    } catch (err) {
      console.error('WY-Terminal | Failed to import status file:', err);
      throw err;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GM COMMAND DISPATCH — Handle commands from MuthurEngine
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Process a GM command forwarded from the MuthurEngine.
   * @param {Object} cmd - The command object with a `type` field
   */
  async handleGmCommand(cmd) {
    switch (cmd.type) {
      case 'update_crew_location':
        if (cmd.name && cmd.location) {
          await this.updateCrewMember(cmd.name, { location: cmd.location.toUpperCase() });
        }
        break;

      case 'update_crew_status':
        if (cmd.name && cmd.status) {
          await this.updateCrewMember(cmd.name, { status: cmd.status.toUpperCase() });
        }
        break;

      case 'assign_crew_task':
        if (cmd.name && cmd.task) {
          await this.updateCrewMember(cmd.name, { task: cmd.task });
        }
        break;

      case 'complete_crew_task':
        if (cmd.name) {
          await this.updateCrewMember(cmd.name, { task: null });
        }
        break;

      case 'update_ship_system':
        if (cmd.system) {
          const updates = {};
          if (cmd.status) updates.status = cmd.status.toUpperCase();
          if (cmd.detail) updates.detail = cmd.detail;
          await this.updateSystem(cmd.system, updates);
        }
        break;

      case 'add_log_entry':
        if (cmd.message) {
          await this.addLog(cmd.source || 'SYSTEM', cmd.message, cmd.level || '');
        }
        break;

      case 'set_game_time':
        if (cmd.time) {
          await this.update({ gameTime: cmd.time });
        }
        break;

      default:
        console.warn(`ShipStatusManager | Unknown GM command type: ${cmd.type}`);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     INTERNAL
     ══════════════════════════════════════════════════════════════════ */

  _load() {
    try {
      this._status = game.settings.get('wy-terminal', 'shipStatusData') || {};
    } catch {
      this._status = {};
    }
  }

  async _save() {
    try {
      await game.settings.set('wy-terminal', 'shipStatusData', this._status);
    } catch (err) {
      console.error('WY-Terminal | Failed to save status:', err);
    }
  }

  _broadcast(updates) {
    game.socket.emit('module.wy-terminal', {
      type: 'statusUpdate',
      payload: updates,
    });
  }

  _buildExportData() {
    const crew = game.settings.get('wy-terminal', 'crewRoster') || [];
    const systems = game.settings.get('wy-terminal', 'shipSystems') || [];
    const logs = game.settings.get('wy-terminal', 'logEntries') || [];

    return {
      shipName: game.settings.get('wy-terminal', 'shipName'),
      shipClass: game.settings.get('wy-terminal', 'shipClass'),
      shipRegistry: game.settings.get('wy-terminal', 'shipRegistry'),
      missionName: game.settings.get('wy-terminal', 'missionName'),
      timestamp: new Date().toISOString(),
      status: this._status,
      crew: crew.map(c => ({
        name: c.name,
        role: c.role,
        location: c.location,
        status: c.status,
      })),
      systems: systems.map(s => ({
        name: s.name,
        status: s.status,
        detail: s.detail,
      })),
      recentLogs: logs.slice(0, 20),
    };
  }

  /**
   * Import data from a MuthurGPT save file config object.
   * Maps MuthurGPT flags to terminal status.
   */
  _importMuthurSave(config) {
    const updates = {};

    // Map MuthurGPT flags to terminal status
    if (config.montero_self_destruct_active !== undefined) {
      updates.selfDestructActive = config.montero_self_destruct_active;
    }
    if (config.montero_engines_offline !== undefined) {
      updates.enginesOffline = config.montero_engines_offline;
    }
    if (config.docked_with_cronus !== undefined) {
      updates.dockedWithCronus = config.docked_with_cronus;
    }
    if (config.unknown_signal_detected !== undefined) {
      updates.signalDetected = config.unknown_signal_detected;
    }

    // Import crew data if present
    if (config.crew) {
      try {
        const crew = Object.entries(config.crew).map(([name, data]) => ({
          name: name.toUpperCase(),
          role: (data.role || 'UNKNOWN').toUpperCase(),
          location: (data.location || 'UNKNOWN').toUpperCase(),
          status: (data.status || 'ACTIVE').toUpperCase(),
          statusClass: 'online',
          statusTextClass: 'wy-text-green',
        }));
        game.settings.set('wy-terminal', 'crewRoster', crew);
      } catch (e) { /* non-critical */ }
    }

    // Import ship systems if present
    if (config.ship_systems) {
      try {
        const systems = Object.entries(config.ship_systems).map(([name, data]) => ({
          name: name.toUpperCase().replace(/_/g, ' '),
          status: typeof data === 'object' ? (data.status || 'UNKNOWN').toUpperCase() : String(data).toUpperCase(),
          statusClass: 'online',
          detail: typeof data === 'object' ? (data.detail || '') : '',
        }));
        game.settings.set('wy-terminal', 'shipSystems', systems);
      } catch (e) { /* non-critical */ }
    }

    this.update(updates);
  }
}
