/**
 * Weyland-Yutani Ship Terminal — FoundryVTT Module Entry Point
 * An interactive green-screen terminal interface for AlienRPG.
 */

import { WYTerminalApp } from './terminal-app.mjs';
import { ShipStatusManager } from './ship-status.mjs';
import { MuthurBridge } from './muthur-bridge.mjs';
import { MuthurEngine } from './muthur-engine.mjs';
import { registerSettings } from './settings.mjs';

/* ──────────────────────────────────────────────────────────────────
   Module Initialization
   ────────────────────────────────────────────────────────────────── */

let terminalApp = null;
let shipStatus = null;

Hooks.once('init', () => {
  console.log('WY-Terminal | Initializing Weyland-Yutani Ship Terminal');

  // Register module settings
  registerSettings();

  // Register Handlebars helpers needed for the terminal
  _registerHandlebarsHelpers();

  // Pre-load templates
  loadTemplates([
    'modules/wy-terminal/templates/terminal.hbs',
    'modules/wy-terminal/templates/views/boot.hbs',
    'modules/wy-terminal/templates/views/status.hbs',
    'modules/wy-terminal/templates/views/crew.hbs',
    'modules/wy-terminal/templates/views/systems.hbs',
    'modules/wy-terminal/templates/views/logs.hbs',
    'modules/wy-terminal/templates/views/muthur.hbs',
    'modules/wy-terminal/templates/views/scenes.hbs',
    'modules/wy-terminal/templates/views/maps.hbs',
    'modules/wy-terminal/templates/views/emergency.hbs',
    'modules/wy-terminal/templates/views/nav.hbs',
    'modules/wy-terminal/templates/views/comms.hbs',
    'modules/wy-terminal/templates/views/cargo.hbs',
    'modules/wy-terminal/templates/views/settings.hbs',
  ]);
});

Hooks.once('ready', () => {
  console.log('WY-Terminal | Ready');

  // Initialize ship status manager
  shipStatus = new ShipStatusManager();

  // Expose to global scope for macros / debugging
  game.wyTerminal = {
    open: openTerminal,
    close: closeTerminal,
    toggle: toggleTerminal,
    status: shipStatus,
    app: () => terminalApp,
    sendGmCommand: (cmd) => MuthurBridge.sendGmCommand(cmd),
    getPlugins: () => MuthurEngine.getAvailablePlugins(),
    MuthurEngine,
  };

  // Add terminal button to scene controls
  console.log('WY-Terminal | Module loaded. Use game.wyTerminal.open() or the scene control button.');
});

/* ──────────────────────────────────────────────────────────────────
   Scene Controls — Add terminal button
   ────────────────────────────────────────────────────────────────── */

Hooks.on('getSceneControlButtons', (controls) => {
  const tokenControls = controls.find(c => c.name === 'token');
  if (tokenControls) {
    tokenControls.tools.push({
      name: 'wy-terminal',
      title: 'W-Y Terminal',
      icon: 'fas fa-terminal',
      button: true,
      onClick: () => toggleTerminal(),
    });
  }
});

/* ──────────────────────────────────────────────────────────────────
   Terminal Open / Close / Toggle
   ────────────────────────────────────────────────────────────────── */

function openTerminal() {
  if (terminalApp && terminalApp.rendered) {
    terminalApp.bringToTop();
    return terminalApp;
  }
  terminalApp = new WYTerminalApp({ shipStatus });
  terminalApp.render(true);
  return terminalApp;
}

function closeTerminal() {
  if (terminalApp) {
    terminalApp.close();
    terminalApp = null;
  }
}

function toggleTerminal() {
  if (terminalApp?.rendered) {
    closeTerminal();
  } else {
    openTerminal();
  }
}

/* ──────────────────────────────────────────────────────────────────
   Socket Handling — Sync status across clients
   ────────────────────────────────────────────────────────────────── */

Hooks.once('ready', () => {
  game.socket.on('module.wy-terminal', (data) => {
    if (data.type === 'statusUpdate' && shipStatus) {
      shipStatus.mergeRemoteUpdate(data.payload);
      if (terminalApp?.rendered) {
        terminalApp.refreshCurrentView();
      }
    }
    if (data.type === 'alert' && terminalApp?.rendered) {
      terminalApp.showAlert(data.payload.message);
    }
    // GM commands are handled by MuthurEngine's own socket listener
    // (set up when the engine initializes inside MuthurBridge)
  });
});

/* ──────────────────────────────────────────────────────────────────
   Handlebars Helpers
   ────────────────────────────────────────────────────────────────── */

function _registerHandlebarsHelpers() {
  Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
  });

  Handlebars.registerHelper('wyTimestamp', function () {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });
}
