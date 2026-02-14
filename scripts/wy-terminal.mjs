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

  // Determine display mode
  let displayMode = 'normal';
  try {
    displayMode = game.settings.get('wy-terminal', 'displayMode') || 'normal';
  } catch (e) { /* first load */ }

  const isTerminalDisplay = displayMode === 'terminal';
  console.log(`WY-Terminal | Display mode: ${displayMode}`);

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
    isTerminalDisplay,
  };

  // Terminal Display mode: hide ALL Foundry UI chrome and go full-screen
  if (isTerminalDisplay) {
    console.log('WY-Terminal | Enabling Terminal Display mode — hiding Foundry UI');
    _enableTerminalDisplayMode();
  }

  // Auto-open the terminal
  console.log('WY-Terminal | Auto-opening terminal...');
  openTerminal();
});

/* ──────────────────────────────────────────────────────────────────
   Scene Controls — Add terminal button
   ────────────────────────────────────────────────────────────────── */

Hooks.on('getSceneControlButtons', (controls) => {
  console.log('WY-Terminal | getSceneControlButtons fired, controls type:', typeof controls, Array.isArray(controls));

  try {
    // FoundryVTT v13: controls may be an array or iterable
    // Try to find the token controls group (named 'token' or 'tokens')
    let tokenControls;
    if (Array.isArray(controls)) {
      tokenControls = controls.find(c => c.name === 'token' || c.name === 'tokens');
    } else if (controls instanceof Map) {
      tokenControls = controls.get('token') || controls.get('tokens');
    } else if (typeof controls === 'object') {
      // v13 may use a plain object or other structure
      tokenControls = controls.token || controls.tokens;
    }

    const toolDef = {
      name: 'wy-terminal',
      title: 'W-Y Terminal',
      icon: 'fas fa-terminal',
      button: true,
      onClick: () => toggleTerminal(),
      onChange: () => toggleTerminal(),
    };

    if (tokenControls?.tools) {
      if (Array.isArray(tokenControls.tools)) {
        tokenControls.tools.push(toolDef);
      } else if (tokenControls.tools instanceof Map) {
        tokenControls.tools.set('wy-terminal', toolDef);
      }
      console.log('WY-Terminal | Added button to token controls');
    } else {
      // Fallback: add to first available control group
      const first = Array.isArray(controls) ? controls[0] : null;
      if (first?.tools) {
        if (Array.isArray(first.tools)) {
          first.tools.push(toolDef);
        } else if (first.tools instanceof Map) {
          first.tools.set('wy-terminal', toolDef);
        }
        console.log('WY-Terminal | Added button to first control group:', first.name);
      } else {
        console.warn('WY-Terminal | Could not find any control group. Controls:', controls);
        // Log the structure for debugging
        if (Array.isArray(controls)) {
          controls.forEach((c, i) => console.log(`  control[${i}]:`, c.name, typeof c.tools));
        }
      }
    }
  } catch (err) {
    console.error('WY-Terminal | Failed to add scene control button:', err);
  }
});

/* ──────────────────────────────────────────────────────────────────
   Terminal Display Mode — Full-screen takeover
   ────────────────────────────────────────────────────────────────── */

/**
 * Inject CSS to hide all Foundry UI elements and prepare for full-viewport terminal.
 * Only active when displayMode === 'terminal'.
 */
function _enableTerminalDisplayMode() {
  const style = document.createElement('style');
  style.id = 'wy-terminal-display-mode';
  style.textContent = `
    /* ═══════ TERMINAL DISPLAY MODE ═══════
       Hide ALL Foundry UI — only the terminal is visible */

    /* Core Foundry UI elements */
    #sidebar,
    #hotbar,
    #navigation,
    #controls,
    #players,
    #logo,
    #pause,
    #loading,
    #chat-controls,
    #camera-views,
    nav#scene-navigation,
    #ui-top,
    #ui-bottom,
    #ui-left,
    #ui-right,
    .notification-pip,
    #context-menu,
    .app:not(.wy-terminal-app) {
      display: none !important;
    }

    /* Hide the canvas — we render scenes inside the terminal */
    #board,
    #canvas {
      display: none !important;
    }

    /* Make body background match terminal */
    body {
      background: #0a0a0a !important;
      overflow: hidden !important;
    }

    /* Full-viewport terminal app */
    .wy-terminal-app {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      z-index: 9999 !important;
    }

    .wy-terminal-app .window-header {
      display: none !important;
    }

    .wy-terminal-app .window-content {
      width: 100% !important;
      height: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    /* Hide the terminal close button in display mode */
    .wy-terminal-display .wy-header-close {
      display: none !important;
    }

    /* Slightly enlarge nav buttons for touch on large displays */
    .wy-terminal-display .wy-nav-btn {
      min-height: 52px;
      font-size: 12px;
    }

    /* Ensure terminal fills its container */
    .wy-terminal-display {
      border-radius: 0 !important;
      border: none !important;
    }
  `;
  document.head.appendChild(style);

  // Add display-mode class to body for additional CSS hooks
  document.body.classList.add('wy-terminal-display-mode');
}

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

  // In Terminal Display mode, add the display class after render
  if (game.wyTerminal?.isTerminalDisplay) {
    Hooks.once('renderWYTerminalApp', (app, html) => {
      const el = html[0] ?? html;
      const terminal = el.querySelector('.wy-terminal') ?? el;
      terminal.classList.add('wy-terminal-display');
      console.log('WY-Terminal | Terminal Display mode active — full viewport');
    });
  }

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
    if (data.type === 'sceneChange' && terminalApp?.rendered) {
      // GM pushed a scene change — switch terminal to that scene
      terminalApp.activeSceneId = data.payload.sceneId;
      terminalApp._switchView('scenes');
    }
    if (data.type === 'refreshTokens' && terminalApp?.rendered) {
      // Token update on the active scene — re-render if on scenes view
      if (terminalApp.activeView === 'scenes') {
        terminalApp._renderView('scenes');
      }
    }
    // GM commands are handled by MuthurEngine's own socket listener
    // (set up when the engine initializes inside MuthurBridge)
  });
});

/* ──────────────────────────────────────────────────────────────────
   Scene Hooks — Auto-sync when GM changes active scene or tokens
   ────────────────────────────────────────────────────────────────── */

// When a scene is activated (GM switches scenes), broadcast to display clients
Hooks.on('canvasReady', (canvas) => {
  if (game.user.isGM && canvas?.scene) {
    console.log('WY-Terminal | Scene activated:', canvas.scene.name);
    game.socket.emit('module.wy-terminal', {
      type: 'sceneChange',
      payload: { sceneId: canvas.scene.id },
    });
  }
  // If this IS the display client, also auto-switch
  if (game.wyTerminal?.isTerminalDisplay && terminalApp?.rendered) {
    terminalApp.activeSceneId = canvas?.scene?.id;
    if (terminalApp.activeView === 'scenes') {
      terminalApp._renderView('scenes');
    }
  }
});

// When tokens are created/updated/deleted, refresh the display
Hooks.on('createToken', (token) => {
  _broadcastTokenRefresh(token.parent);
});
Hooks.on('updateToken', (token) => {
  _broadcastTokenRefresh(token.parent);
});
Hooks.on('deleteToken', (token) => {
  _broadcastTokenRefresh(token.parent);
});

function _broadcastTokenRefresh(scene) {
  if (!scene) return;
  // Only GM broadcasts, to avoid duplicate messages
  if (game.user.isGM) {
    game.socket.emit('module.wy-terminal', {
      type: 'refreshTokens',
      payload: { sceneId: scene.id },
    });
  }
  // Also refresh locally if this is the display
  if (terminalApp?.rendered && terminalApp.activeView === 'scenes' && terminalApp.activeSceneId === scene.id) {
    terminalApp._renderView('scenes');
  }
}

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
