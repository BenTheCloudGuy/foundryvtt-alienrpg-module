/**
 * Weyland-Yutani Ship Terminal — FoundryVTT Module Entry Point
 * An interactive green-screen terminal interface for AlienRPG.
 */

import { WYTerminalApp } from './terminal-app.mjs';
import { ShipStatusManager } from './ship-status.mjs';
import { MuthurBridge } from './muthur-bridge.mjs';
import { MuthurEngine } from './muthur-engine.mjs';
import { registerSettings } from './settings.mjs';
import { TerminalSFX } from './terminal-sounds.mjs';
import { SHIP_PROFILES, getAvailableProfiles } from './ship-profiles.mjs';
import { NAV_CHART, drawNavStarChart, drawPlanetImage } from './nav-chart.mjs';

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
    'modules/wy-terminal/templates/views/starsystems.hbs',
    'modules/wy-terminal/templates/views/emergency.hbs',
    'modules/wy-terminal/templates/views/nav.hbs',
    'modules/wy-terminal/templates/views/sensors.hbs',
    'modules/wy-terminal/templates/views/comms.hbs',
    'modules/wy-terminal/templates/views/cargo.hbs',
    'modules/wy-terminal/templates/views/settings.hbs',
  ]);
});

Hooks.once('ready', () => {
  console.log('WY-Terminal | Ready');

  // Initialize ship status manager
  shipStatus = new ShipStatusManager();

  // Initialize game clock anchor on first boot (GM only)
  if (game.user.isGM) {
    try {
      const anchor = game.settings.get('wy-terminal', 'gameClockRealAnchor');
      if (!anchor) {
        game.settings.set('wy-terminal', 'gameClockRealAnchor', Date.now());
        console.log('WY-Terminal | Game clock anchor initialized');
      }
    } catch (e) { /* settings not yet registered */ }
  }

  // Players ALWAYS get full-screen terminal display mode
  // GM gets normal Foundry UI with terminal as a pop-out
  const isTerminalDisplay = !game.user.isGM;
  console.log(`WY-Terminal | Display mode: ${isTerminalDisplay ? 'TERMINAL (full-screen)' : 'GM (normal)'}`);

  // Expose to global scope for macros / debugging
  game.wyTerminal = {
    open: openTerminal,
    close: closeTerminal,
    toggle: toggleTerminal,
    status: shipStatus,
    app: () => terminalApp,
    sendGmCommand: (cmd) => MuthurBridge.sendGmCommand(cmd),
    getPlugins: () => MuthurEngine.getAvailablePlugins(),
    setupRadarScene: () => setupRadarScene(),
    setupNavScene: () => setupNavScene(),
    plotNavSystems: () => plotNavSystems(),
    importItemsToStarDB: () => importItemsToStarDB(),
    buildSystemActors: () => buildSystemActorsFromStarDB(),
    buildSystemActorsFromStarDB: () => buildSystemActorsFromStarDB(),
    rebuildSystemsClean: () => rebuildSystemsClean(),
    generatePlanetImages: () => generatePlanetImages(),
    buildShipActors: () => buildShipActors(),
    importAlienContent: (opts) => importAlienContent(opts),
    importSpacecraft: () => importAlienContent({ spacecraftOnly: true }),
    triggerHazard: (deckId, idOrLabel, reveal) => terminalApp?.triggerSensorMarker(deckId, idOrLabel, reveal),
    lockAllDoors: () => terminalApp?._setShipDoors(true),
    unlockAllDoors: () => terminalApp?._setShipDoors(false),
    MuthurEngine,
    isTerminalDisplay,
  };

  // Player clients: hide ALL Foundry UI chrome and go full-screen
  if (isTerminalDisplay) {
    console.log('WY-Terminal | Player display — hiding all Foundry UI, full-screen terminal');
    _enableTerminalDisplayMode();
  }

  // Auto-open the terminal
  console.log('WY-Terminal | Auto-opening terminal...');
  openTerminal();

  // GM: resume driving the ship if a NAV course is already in progress.
  if (game.user.isGM) {
    try { terminalApp?._startNavCourseTicker?.(); } catch (e) { /* nav not ready */ }
    // Auto-plot/refresh SYSTEM tokens on the NAV scene (fit to the map), so the
    // GM never has to open settings to populate navigation.
    try { plotNavSystems({ auto: true }); } catch (e) { /* nav scene not ready */ }
  }
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
    #notifications,
    .notifications,
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

    /* Hide the terminal close button — always hidden */
    .wy-header-close {
      display: none !important;
    }

    /* Enlarge nav buttons for touch on large displays */
    .wy-terminal .wy-nav-btn {
      min-height: 52px;
      font-size: 12px;
    }

    /* Terminal fills its container — no border/radius */
    .wy-terminal {
      border-radius: 0 !important;
      border: none !important;
    }
  `;
  document.head.appendChild(style);

  // Add display-mode class to body for additional CSS hooks
  document.body.classList.add('wy-terminal-display-mode');

  // Suppress Foundry's core "no vision token" warning on player terminals —
  // the canvas is hidden here, so that notice is just noise.
  _installTerminalNotificationFilter();
}

/**
 * On player terminal clients, filter out core Foundry notifications that are
 * meaningless when the canvas is hidden (e.g. the "no Token in this Scene which
 * gives you visibility of the area" vision warning). All warn/info/error calls
 * route through Notifications#notify, so wrapping that one method covers them.
 */
function _installTerminalNotificationFilter() {
  const notif = ui?.notifications;
  if (notif && notif._wyFiltered) return;
  if (notif) notif._wyFiltered = true;

  const FRAGMENTS = [
    'visibility of the area',   // English core vision message
    'no Token in this Scene',
    'VisionNotFound',           // candidate i18n keys
    'NoVisionToken',
    'WarningNoVisionToken',
  ];

  const shouldSuppress = (message, opts) => {
    try {
      let text = (typeof message === 'string') ? message : (message?.message ?? '');
      if (opts?.localize && game?.i18n) text = game.i18n.localize(text);
      // If it still looks like a bare i18n key, resolve it too
      const resolved = (game?.i18n && text && !text.includes(' ')) ? game.i18n.localize(text) : text;
      return FRAGMENTS.some(f => (text && text.includes(f)) || (resolved && resolved.includes(f)));
    } catch (_) {
      return false;
    }
  };

  // Wrap notify() when available (covers warn/info/error that route through it).
  if (notif && typeof notif.notify === 'function') {
    const origNotify = notif.notify.bind(notif);
    notif.notify = function (message, type, options) {
      const opts = (type && typeof type === 'object') ? type : options;
      if (shouldSuppress(message, opts)) return undefined;
      return origNotify(message, type, options);
    };
  }

  // Belt-and-suspenders: v13 may render some notifications through a path that
  // bypasses notify(), and the canvas vision warning can fire before this runs.
  // Watch the DOM and remove any notification element whose text matches.
  const removeMatching = (root) => {
    try {
      const nodes = [];
      if (root.matches?.('.notification, li.notification')) nodes.push(root);
      root.querySelectorAll?.('.notification, #notifications li, .notifications li').forEach(n => nodes.push(n));
      for (const n of nodes) {
        const txt = n.textContent || '';
        if (FRAGMENTS.some(f => txt.includes(f))) n.remove();
      }
    } catch (_) { /* noop */ }
  };
  try {
    // Clear anything already on screen
    removeMatching(document.body);
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) removeMatching(node);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    notif._wyObserver = obs;
  } catch (_) { /* noop */ }
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

/**
 * Configure the "RADAR" scene: apply the generated radar-scope background and a
 * square, gridless canvas so SPACECRAFT tokens line up with the radar rings.
 * Center of the scene = ship (radar origin); the outer ring = maximum range.
 */
async function setupRadarScene() {
  if (!game.user.isGM) {
    ui.notifications.warn('WY-Terminal: Only the GM can configure the RADAR scene.');
    return;
  }
  const scenes = game.scenes?.contents || [];
  const scene = scenes.find(s => (s.name || '').toUpperCase() === 'RADAR')
    || scenes.find(s => (s.name || '').toUpperCase().includes('RADAR'));
  if (!scene) {
    ui.notifications.error('WY-Terminal: No scene named "RADAR" found. Create an empty scene called RADAR first.');
    return;
  }
  try {
    // Use flattened keys so partial nested fields (background.src, grid.type)
    // update cleanly without dropping other required subfields.
    await scene.update({
      'background.src': 'modules/wy-terminal/images/radar-scope.png',
      'background.offsetX': 0,
      'background.offsetY': 0,
      width: 1024,
      height: 1024,
      padding: 0,
      backgroundColor: '#020802',
      'grid.type': 0,
      'grid.size': 128,
    });
    // If the RADAR scene is currently being viewed, force a redraw so the new
    // background paints immediately.
    if (canvas?.scene?.id === scene.id) {
      try { await canvas.draw(); } catch (_) { /* non-fatal */ }
    }
    ui.notifications.info('WY-Terminal: RADAR scene configured. Drop SPACECRAFT tokens on it to track them on SENSORS ▸ EXTERNAL.');
    console.log(`WY-Terminal | RADAR scene "${scene.name}" background + dimensions configured.`);
  } catch (e) {
    console.error('WY-Terminal | Failed to configure RADAR scene:', e);
    ui.notifications.error(`WY-Terminal: Could not configure RADAR scene — ${e?.message || e}. Check console.`);
  }
}

/**
 * Configure the "NAV" scene: apply a square 1920² / 64px light-year grid (Sol at
 * the centre = 0,0) and bake the shared green star chart into the scene
 * background so the GM sees the same chart the terminal renders.
 */
async function setupNavScene() {
  if (!game.user.isGM) {
    ui.notifications.warn('WY-Terminal: Only the GM can configure the NAV scene.');
    return;
  }
  const scenes = game.scenes?.contents || [];
  const scene = scenes.find(s => (s.name || '').toUpperCase() === 'NAV')
    || scenes.find(s => (s.name || '').toUpperCase() === 'NAVIGATION')
    || scenes.find(s => /\bNAV\b/.test((s.name || '').toUpperCase()));
  if (!scene) {
    ui.notifications.error('WY-Terminal: No scene named "NAV" found. Create an empty scene called NAV first.');
    return;
  }

  // Bake the star chart into a PNG and upload it as the scene background (best-effort).
  let bgPath = null;
  try {
    const cvs = document.createElement('canvas');
    cvs.width = NAV_CHART.sizePx;
    cvs.height = NAV_CHART.sizePx;
    const ctx = cvs.getContext('2d');
    if (ctx) {
      drawNavStarChart(ctx);
      const blob = await new Promise((res) => cvs.toBlob(res, 'image/png'));
      if (blob) {
        const dir = `worlds/${game.world.id}/wy-terminal`;
        try { await FilePicker.createDirectory('data', dir); } catch (_) { /* exists */ }
        const file = new File([blob], 'nav-grid.png', { type: 'image/png' });
        const up = await FilePicker.upload('data', dir, file, {}, { notify: false });
        bgPath = up?.path || `${dir}/nav-grid.png`;
      }
    }
  } catch (e) {
    console.warn('WY-Terminal | Could not generate/upload NAV background (scene will use black + grid):', e);
  }

  try {
    const update = {
      width: NAV_CHART.sizePx,
      height: NAV_CHART.sizePx,
      padding: 0,
      backgroundColor: '#000400',
      'grid.type': 1,
      'grid.size': NAV_CHART.gridPx,
      'background.offsetX': 0,
      'background.offsetY': 0,
    };
    if (bgPath) update['background.src'] = bgPath;
    await scene.update(update);
    if (canvas?.scene?.id === scene.id) {
      try { await canvas.draw(); } catch (_) { /* non-fatal */ }
    }
    ui.notifications.info('WY-Terminal: NAV scene configured. SOL is at 0,0 (centre). Drop STATION/SYSTEM/SHIP tokens, or run PLOT KNOWN SYSTEMS.');
    console.log(`WY-Terminal | NAV scene "${scene.name}" configured (${NAV_CHART.sizePx}px, ${NAV_CHART.gridPx}px grid).`);
  } catch (e) {
    console.error('WY-Terminal | Failed to configure NAV scene:', e);
    ui.notifications.error(`WY-Terminal: Could not configure NAV scene — ${e?.message || e}. Check console.`);
  }
}

/** Parse a Middle Heavens coordinate string into {spinward, coreward}, or null. */
function _parseNavCoord(str) {
  if (!str || /classified/i.test(str)) return null;
  let spin = null, core = null;
  for (const part of String(str).split(/[,/]/)) {
    const m = /([+-]?\d+(?:\.\d+)?)\s*(spinward|antispinward|coreward|rimward)?/i.exec(part.trim());
    if (!m) continue;
    const v = parseFloat(m[1]);
    const dir = (m[2] || '').toLowerCase();
    if (dir === 'spinward') spin = Math.abs(v);
    else if (dir === 'antispinward') spin = -Math.abs(v);
    else if (dir === 'coreward') core = Math.abs(v);
    else if (dir === 'rimward') core = -Math.abs(v);
    else if (spin === null) spin = v;      // no direction word (e.g. Sol "0.0 / 0.0")
    else if (core === null) core = v;
  }
  if (spin === null && core === null) return null;
  return { spinward: spin || 0, coreward: core || 0 };
}

/**
 * Plot SYSTEM contacts onto the NAV scene as tokens at their coordinates
 * (idempotent — matched by a systemId flag). Prefers the built SYSTEM actors
 * (type `planet` flagged navType=SYSTEM with spinward/coreward), so tokens link
 * to the actor and the NAV readout reads its dossier. Falls back to the bundled
 * stellar-cartography JSON when no System actors exist yet.
 */
async function plotNavSystems({ auto = false } = {}) {
  if (!game.user.isGM) {
    if (!auto) ui.notifications.warn('WY-Terminal: Only the GM can plot systems.');
    return;
  }
  const scenes = game.scenes?.contents || [];
  const scene = scenes.find(s => (s.name || '').toUpperCase() === 'NAV')
    || scenes.find(s => (s.name || '').toUpperCase() === 'NAVIGATION')
    || scenes.find(s => /\bNAV\b/.test((s.name || '').toUpperCase()));
  if (!scene) {
    if (!auto) ui.notifications.error('WY-Terminal: No NAV scene found. Create + configure it first.');
    return;
  }

  const dims = scene.dimensions || {};
  const imgW = dims.sceneWidth || scene.width;
  const imgH = dims.sceneHeight || scene.height;
  const tokGrid = scene.grid?.size || NAV_CHART.gridPx;
  const existing = scene.tokens?.contents || [];

  // Build a plot list of { id, name, spinward, coreward, actorId, img, navType }.
  // Coordinates trace back to the Middle Heavens starmap (planet-system item
  // `location` → STAR DB → the SYSTEM actor's spinward/coreward flags). If an
  // actor is missing those flags, fall back to the STAR DB entry so EVERY
  // system with a known location gets placed.
  try { await terminalApp?._loadStarSystemsData?.(); } catch (_) { /* use cache */ }
  const starDb = terminalApp?._starSystemsCache?.systems || [];
  const dbCoordFor = (a) => {
    const starId = a.getFlag('wy-terminal', 'starDbId') || a.getFlag('wy-terminal', 'systemSourceId');
    let entry = starId ? starDb.find(s => s.id === starId) : null;
    if (!entry) entry = starDb.find(s => (s.name || '').toUpperCase() === (a.name || '').toUpperCase());
    return entry?.coordinates || '';
  };

  const plots = [];
  const unplaced = [];
  const systemActors = game.actors.filter(a => a.type === 'planet' && a.getFlag('wy-terminal', 'navType') === 'SYSTEM');
  let source = 'actors';
  if (systemActors.length) {
    for (const a of systemActors) {
      let spin = a.getFlag('wy-terminal', 'spinward');
      let core = a.getFlag('wy-terminal', 'coreward');
      if (spin == null || core == null) {
        const c = _parseNavCoord(dbCoordFor(a) || a.getFlag('wy-terminal', 'coordinates') || '');
        if (c) { spin = c.spinward; core = c.coreward; }
      }
      if (spin == null || core == null) { unplaced.push(a.name); continue; }
      plots.push({
        id: a.getFlag('wy-terminal', 'systemSourceId') || a.id,
        name: a.name,
        spinward: spin,
        coreward: core,
        actorId: a.id,
        img: a.img || 'icons/svg/circle.svg',
        navType: 'SYSTEM',
      });
    }
  } else {
    source = 'json';
    try {
      const resp = await fetch('modules/wy-terminal/muthur/starsystems.json', { cache: 'no-store' });
      const data = await resp.json();
      for (const s of (Array.isArray(data.systems) ? data.systems : [])) {
        const coord = _parseNavCoord(s.coordinates);
        if (!coord) { unplaced.push(s.name); continue; }
        plots.push({
          id: s.id,
          name: s.name,
          spinward: coord.spinward,
          coreward: coord.coreward,
          actorId: null,
          img: 'icons/svg/circle.svg',
          navType: 'SYSTEM',
        });
      }
    } catch (e) {
      ui.notifications.error('WY-Terminal: Could not load stellar-cartography database.');
      console.error('WY-Terminal | plotNavSystems fetch failed:', e);
      return;
    }
  }

  if (!plots.length) {
    if (!auto) ui.notifications.warn('WY-Terminal: No systems with coordinates to plot. Run BUILD SYSTEM ACTORS first.');
    return;
  }

  // Even distribution ("declustered"). The real coordinates are bimodal in X —
  // a rimward group hugging Sol and a far-coreward group — with an empty middle,
  // so any proportional placement bunches them left/right of Sol. Instead we
  // RANK each system along X and Y independently and drop it into an evenly
  // spaced slot: this fills the whole chart with no clustering while preserving
  // left→right (coreward) and bottom→top (spinward) ordering.
  const MARGIN = 0.06;
  const left = (dims.sceneX || 0) + imgW * MARGIN;
  const bottom = (dims.sceneY || 0) + imgH * (1 - MARGIN);
  const usableW = imgW * (1 - 2 * MARGIN);
  const usableH = imgH * (1 - 2 * MARGIN);
  const n = plots.length;
  const byX = [...plots].sort((a, b) => (a.coreward - b.coreward) || (a.spinward - b.spinward));
  const byY = [...plots].sort((a, b) => (a.spinward - b.spinward) || (a.coreward - b.coreward));
  const xRank = new Map(); byX.forEach((p, i) => xRank.set(p, i));
  const yRank = new Map(); byY.forEach((p, i) => yRank.set(p, i));
  const frac = (r) => (n <= 1 ? 0.5 : r / (n - 1));

  const toCreate = [];
  const toUpdate = [];
  for (const p of plots) {
    const cx = left + frac(xRank.get(p)) * usableW;    // COREWARD order → left → right
    const cy = bottom - frac(yRank.get(p)) * usableH;  // SPINWARD order → bottom → top
    const x = Math.round(cx - tokGrid / 2);
    const y = Math.round(cy - tokGrid / 2);
    const found = existing.find(t => t.flags?.['wy-terminal']?.systemId === p.id);
    if (found) {
      // Reposition and force SYSTEM type (repairs any tokens left as STATION).
      toUpdate.push({ _id: found.id, x, y, 'flags.wy-terminal.navType': 'SYSTEM' });
    } else {
      const tok = {
        name: p.name,
        x, y,
        width: 1,
        height: 1,
        actorLink: false,
        disposition: 0,
        texture: { src: p.img },
        flags: { 'wy-terminal': { systemId: p.id, navType: 'SYSTEM' } },
      };
      if (p.actorId) tok.actorId = p.actorId;
      toCreate.push(tok);
    }
  }

  try {
    if (toCreate.length) await scene.createEmbeddedDocuments('Token', toCreate);
    if (toUpdate.length) await scene.updateEmbeddedDocuments('Token', toUpdate);
    const skipped = unplaced.length
      ? ` ${unplaced.length} had no/classified coordinates: ${unplaced.slice(0, 8).join(', ')}${unplaced.length > 8 ? '…' : ''}.`
      : '';
    if (!auto) {
      ui.notifications.info(`WY-Terminal: Plotted ${toCreate.length} new + ${toUpdate.length} updated SYSTEM(s) from ${source === 'actors' ? 'SYSTEM actors' : 'cartography DB'}.${skipped}`);
    }
    console.log(`WY-Terminal | plotNavSystems (${source}${auto ? ' auto' : ''}): +${toCreate.length}, ~${toUpdate.length}, unplaced ${unplaced.length}.`, unplaced);
  } catch (e) {
    console.error('WY-Terminal | plotNavSystems write failed:', e);
    if (!auto) ui.notifications.error(`WY-Terminal: Could not plot systems — ${e?.message || e}. Check console.`);
  }
}

/** Read a `{value}`-wrapped or plain field. */
function _sv(x) {
  return (x && typeof x === 'object') ? (x.value ?? '') : (x ?? '');
}

/** Build an HTML description for a STAR SYSTEMS entry from a planet-system item. */
function _composeItemDescription(h, d, miscDesc) {
  const rows = [];
  const add = (label, val) => { const v = String(val || '').trim(); if (v) rows.push(`<p><strong>${label}:</strong> ${v}</p>`); };
  add('COMMON NAME', _sv(h.commonName));
  add('CLASSIFICATION', _sv(d.classification));
  add('CLIMATE', _sv(d.climate));
  add('MEAN TEMPERATURE', _sv(d.meanTemperature));
  add('TERRAIN', _sv(d.terrain));
  add('COLONIES', _sv(d.colonies));
  add('POPULATION', _sv(d.population));
  add('KEY RESOURCES', _sv(d.keyResources));
  let html = rows.join('\n');
  const desc = String(miscDesc || '').trim();
  if (desc) html += `\n<hr>\n${desc}`;
  return html;
}

/**
 * Seed the STAR SYSTEMS database from the installed AlienRPG `planet-system`
 * items. The STAR SYSTEMS DB is the single source of truth for systems, so this
 * imports the rich item data into it (as GM "added" override entries, idempotent
 * by a `wyt-item-<id>` id). Coordinates come from the item `location`. Build
 * actors afterwards with BUILD SYSTEM ACTORS.
 */
async function importItemsToStarDB({ skipConfirm = false } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn('WY-Terminal: Only the GM can import systems.');
    return;
  }

  // Gather planet-system items: prefer world items, else scan Item compendiums.
  let items = (game.items?.contents || []).filter(i => i.type === 'planet-system');
  let fromPacks = false;
  if (!items.length) {
    fromPacks = true;
    for (const pack of game.packs.filter(p => p.documentName === 'Item')) {
      try {
        const idx = await pack.getIndex({ fields: ['type'] });
        const ids = idx.filter(e => e.type === 'planet-system').map(e => e._id);
        for (const id of ids) {
          const doc = await pack.getDocument(id);
          if (doc) items.push(doc);
        }
      } catch (_) { /* skip unreadable pack */ }
    }
  }
  if (!items.length) {
    ui.notifications.error('WY-Terminal: No PLANET-SYSTEM items found. Import AlienRPG content first.');
    return;
  }

  if (!skipConfirm) {
    const proceed = await _wyConfirm(
      'Import Items → STAR SYSTEMS DB',
      `Import ${items.length} PLANET-SYSTEM item(s)${fromPacks ? ' (from compendiums)' : ''} into the STAR SYSTEMS database?`
    );
    if (!proceed) return;
  }

  const overrides = foundry.utils.deepClone(game.settings.get('wy-terminal', 'starSystemsData') ?? {});
  overrides.added ??= [];
  overrides.modified ??= {};
  overrides.deleted ??= [];

  let added = 0, updated = 0;
  for (const it of items) {
    const sysd = it.system || {};
    const h = sysd.header || {};
    const d = sysd.details || {};
    const miscDesc = _sv(sysd.misc?.description);
    const id = `wyt-item-${it.id}`;
    const entry = {
      id,
      type: 'system',
      name: _sv(h.system) || _sv(h.commonName) || it.name || 'UNKNOWN SYSTEM',
      territory: '',
      sector: _sv(h.sector),
      coordinates: _sv(h.location) || 'CLASSIFIED',
      affiliation: _sv(d.affiliation),
      classification: 'NONE',
      status: 'SURVEYED',
      description: _composeItemDescription(h, d, miscDesc),
      bodies: [],
    };
    const idx = overrides.added.findIndex(e => e.id === id);
    if (idx >= 0) { overrides.added[idx] = entry; updated++; }
    else { overrides.added.push(entry); added++; }
  }

  try {
    await game.settings.set('wy-terminal', 'starSystemsData', overrides);
    await terminalApp?._loadStarSystemsData?.();
    try { terminalApp?._broadcastSocket?.('refreshView', { view: 'starsystems' }); } catch (_) { /* noop */ }
    if (terminalApp?.rendered && terminalApp.activeView === 'starsystems') terminalApp._renderView('starsystems');
    ui.notifications.info(`WY-Terminal: Imported ${added} new + ${updated} updated system(s) into the STAR SYSTEMS DB. Now run BUILD SYSTEM ACTORS.`);
    console.log(`WY-Terminal | importItemsToStarDB: +${added}, ~${updated}.`);
  } catch (e) {
    console.error('WY-Terminal | importItemsToStarDB failed:', e);
    ui.notifications.error(`WY-Terminal: Could not import systems — ${e?.message || e}. Check console.`);
  }
}

/** Build an HTML dossier for a System actor from a STAR SYSTEMS database entry. */
function _composeStarSystemNotes(s) {
  const rows = [];
  const add = (label, val) => { const v = String(val || '').trim(); if (v) rows.push(`<p><strong>${label}:</strong> ${v}</p>`); };
  add('SYSTEM', s.name);
  add('TERRITORY', s.territory);
  add('SECTOR', s.sector);
  add('COORDINATES', s.coordinates);
  add('AFFILIATION', s.affiliation);
  add('CLASSIFICATION', s.classification);
  add('STATUS', s.status);
  let html = rows.join('\n');
  if (Array.isArray(s.bodies) && s.bodies.length) {
    html += '\n<hr><p><strong>BODIES:</strong></p><ul>'
      + s.bodies.map(b => `<li>${b.name}${b.type ? ` (${b.type})` : ''}${b.detail ? ` — ${b.detail}` : ''}</li>`).join('')
      + '</ul>';
  }
  const desc = String(s.description || '').trim();
  if (desc) html += `\n<hr>\n<p>${desc}</p>`;
  return html;
}

/**
 * Sync SYSTEM actors from the STAR SYSTEMS (stellar-cartography) database. Each
 * DB entry becomes / updates a `planet` actor in "05. SYSTEMS", carrying the
 * system STATUS, sector, territory, affiliation, classification, coordinates,
 * and dossier. Idempotent — matched by a `starDbId` flag. This lets the STAR
 * SYSTEMS list (and its GM edits) drive the System actors + NAV.
 */
async function buildSystemActorsFromStarDB({ skipConfirm = false } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn('WY-Terminal: Only the GM can sync System actors.');
    return;
  }
  try { await terminalApp?._loadStarSystemsData?.(); } catch (_) { /* use cache */ }
  const systems = terminalApp?._starSystemsCache?.systems || [];
  if (!systems.length) {
    ui.notifications.error('WY-Terminal: STAR SYSTEMS database is empty.');
    return;
  }

  if (!skipConfirm) {
    const proceed = await _wyConfirm(
      'Build System Actors from STAR SYSTEMS',
      `Create/update ${systems.length} SYSTEM actor(s) in "05. SYSTEMS" from the STAR SYSTEMS database (status, sector, coordinates, dossier)?`
    );
    if (!proceed) return;
  }

  const folder = await _wyEnsureFolder('Actor', '05. SYSTEMS');
  const existing = game.actors.filter(a => a.type === 'planet' && a.getFlag('wy-terminal', 'starDbId'));

  const toCreate = [];
  const updates = [];
  let noCoord = 0;
  for (const s of systems) {
    const coord = _parseNavCoord(s.coordinates);
    if (!coord) noCoord++;
    const name = String(s.name || 'UNKNOWN SYSTEM').toUpperCase();
    const wyFlags = {
      starDbId: s.id,
      systemId: s.id,
      navType: 'SYSTEM',
      status: String(s.status || 'ACTIVE').toUpperCase(),
      sector: s.sector || '',
      territory: s.territory || '',
      affiliation: s.affiliation || '',
      classification: s.classification || '',
      commonName: s.name || '',
    };
    if (coord) { wyFlags.spinward = coord.spinward; wyFlags.coreward = coord.coreward; }
    const notes = _composeStarSystemNotes(s);

    const found = existing.find(a => a.getFlag('wy-terminal', 'starDbId') === s.id);
    if (found) {
      updates.push(found.update({ name, 'system.notes': notes, 'flags.wy-terminal': wyFlags }));
    } else {
      toCreate.push({
        name,
        type: 'planet',
        folder: folder?.id ?? null,
        img: 'systems/alienrpg/images/icons/solar-system.svg',
        system: { notes },
        flags: { 'wy-terminal': wyFlags },
      });
    }
  }

  try {
    let created = 0;
    if (toCreate.length) created = (await Actor.createDocuments(toCreate)).length;
    if (updates.length) await Promise.all(updates);
    ui.notifications.info(`WY-Terminal: Synced ${created} new + ${updates.length} updated SYSTEM actor(s) from STAR SYSTEMS. ${noCoord} had no/classified coordinates.`);
    console.log(`WY-Terminal | buildSystemActorsFromStarDB: +${created}, ~${updates.length}, noCoord ${noCoord}.`);
  } catch (e) {
    console.error('WY-Terminal | buildSystemActorsFromStarDB failed:', e);
    ui.notifications.error(`WY-Terminal: Could not sync System actors — ${e?.message || e}. Check console.`);
  }
}

/**
 * One-time cleanup + full single-source rebuild:
 *   1. delete legacy System actors from the retired items→actors builder
 *      (flagged `systemSourceId`),
 *   2. import PLANET-SYSTEM items into the STAR SYSTEMS DB, then
 *   3. build System actors from the DB.
 * Single confirmation; the chained steps skip their own prompts.
 */
async function rebuildSystemsClean() {
  if (!game.user.isGM) {
    ui.notifications.warn('WY-Terminal: Only the GM can rebuild systems.');
    return;
  }
  const legacy = game.actors.filter(a => a.type === 'planet' && a.getFlag('wy-terminal', 'systemSourceId'));
  const proceed = await _wyConfirm(
    'Clean + Rebuild Systems',
    `Delete ${legacy.length} legacy System actor(s), import PLANET-SYSTEM items into the STAR SYSTEMS DB, then rebuild System actors from the DB?`
  );
  if (!proceed) return;

  if (legacy.length) {
    try {
      await Actor.deleteDocuments(legacy.map(a => a.id));
      console.log(`WY-Terminal | Removed ${legacy.length} legacy System actor(s).`);
    } catch (e) {
      console.error('WY-Terminal | Legacy cleanup failed:', e);
      ui.notifications.error(`WY-Terminal: Could not remove legacy actors — ${e?.message || e}. Check console.`);
      return;
    }
  }

  await importItemsToStarDB({ skipConfirm: true });
  await buildSystemActorsFromStarDB({ skipConfirm: true });
  ui.notifications.info(`WY-Terminal: Cleaned ${legacy.length} legacy actor(s) and rebuilt systems from the STAR SYSTEMS DB.`);
}

/**
 * Generate procedural monochrome-green planet images for every SYSTEM actor and
 * assign them as the actor + prototype-token art. Baked client-side and uploaded
 * to the world data dir (best-effort; skips a system on upload failure).
 */
async function generatePlanetImages() {
  if (!game.user.isGM) {
    ui.notifications.warn('WY-Terminal: Only the GM can generate planet images.');
    return;
  }
  const actors = game.actors.filter(a => a.type === 'planet' && a.getFlag('wy-terminal', 'navType') === 'SYSTEM');
  if (!actors.length) {
    ui.notifications.error('WY-Terminal: No SYSTEM actors found. Run BUILD SYSTEM ACTORS first.');
    return;
  }
  const proceed = await _wyConfirm(
    'Generate Planet Images',
    `Render monochrome-green planet art for ${actors.length} SYSTEM actor(s)? Images are uploaded to your world data folder.`
  );
  if (!proceed) return;

  const dir = `worlds/${game.world.id}/wy-terminal/planets`;
  try { await FilePicker.createDirectory('data', `worlds/${game.world.id}/wy-terminal`); } catch (_) { /* exists */ }
  try { await FilePicker.createDirectory('data', dir); } catch (_) { /* exists */ }

  let done = 0, failed = 0;
  for (const a of actors) {
    try {
      const cvs = document.createElement('canvas');
      cvs.width = 256; cvs.height = 256;
      const ctx = cvs.getContext('2d');
      drawPlanetImage(ctx, 256, a.name || a.id);
      const blob = await new Promise((res) => cvs.toBlob(res, 'image/png'));
      if (!blob) { failed++; continue; }
      const safe = (a.id || a.name || 'system').replace(/[^a-z0-9_-]/gi, '_');
      const file = new File([blob], `planet-${safe}.png`, { type: 'image/png' });
      const up = await FilePicker.upload('data', dir, file, {}, { notify: false });
      const path = up?.path || `${dir}/planet-${safe}.png`;
      await a.update({ img: path, 'prototypeToken.texture.src': path });
      done++;
    } catch (err) {
      failed++;
      console.warn(`WY-Terminal | planet image failed for ${a.name}:`, err);
    }
  }
  ui.notifications.info(`WY-Terminal: Generated ${done} planet image(s)${failed ? `, ${failed} failed` : ''}. Re-run PLOT KNOWN SYSTEMS to refresh token art.`);
  console.log(`WY-Terminal | generatePlanetImages: ${done} done, ${failed} failed.`);
}

/**
 * Create/update the two campaign spacecraft actors — USCSS MONTERO and
 * USCSS CRONUS — in the world (GM only), populated with canonical stats, ship
 * art, embedded weapon/module items, and crew occupants linked to matching
 * world crew actors by name. Idempotent by `flags.wy-terminal.shipId`.
 */
async function buildShipActors({ skipConfirm = false } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn('WY-Terminal: Only the GM can build ship actors.');
    return;
  }

  const rid = () => foundry.utils.randomID();
  const weapon = (name, { hardpoint, damage = 0, bonus = 0, range = 0, quantity = 1, comment = '' }) => ({
    _id: rid(), name, type: 'spacecraftweapons', img: 'icons/svg/explosion.svg', effects: [],
    system: {
      header: { type: { value: '' }, active: false },
      attributes: {
        bonus: { value: bonus }, damage: { value: damage },
        hardpoint: { value: hardpoint }, cost: { value: '0' },
        range: { value: range }, quantity: { value: quantity },
        comment: { value: comment },
      },
    },
  });
  const mod = (name, { size, capacity = '', quantity = 1, comment = '' }) => ({
    _id: rid(), name, type: 'spacecraftmods', img: 'icons/svg/upgrade.svg', effects: [],
    system: {
      header: { type: { value: '' }, active: false },
      attributes: {
        size: { value: size }, capacity: { value: capacity },
        cost: { value: '0' }, quantity: { value: quantity },
        comment: { value: comment },
      },
    },
  });

  // Link occupants to matching world crew actors by (sur)name.
  const findCrew = (roster) => {
    const occ = [];
    const missing = [];
    for (const { match, position } of roster) {
      const a = game.actors.find(x => ['character', 'synthetic'].includes(x.type)
        && (x.name || '').toLowerCase().includes(match.toLowerCase()));
      if (a) occ.push({ id: a.id, position });
      else missing.push(match);
    }
    return { occ, missing };
  };

  const SHIPS = [
    {
      id: 'montero',
      name: 'USCSS MONTERO',
      img: 'modules/wy-terminal/images/MONTERO.png',
      attributes: {
        manufacturer: 'Lockmart', model: 'CM-88B BISON / M-CLASS STARFREIGHTER',
        modules: '4 x Size IV, 6 x Size III, 8 x Size II', armaments: '',
        ai: 'MU/TH/UR 6000', crew: { value: 5 }, passengers: { value: 0 },
        length: { value: 334 }, ftlrating: { value: 12 }, signature: { value: 1 },
        thrusters: { value: 0 }, hull: { value: 9 }, armor: { value: 6 },
        damage: { value: 0 }, leasecost: { value: '$36,000,000.00' },
      },
      notes: '<h1>USCSS MONTERO</h1><p><strong>CM-88B BISON — M-CLASS COMMERCIAL STARFREIGHTER</strong></p>'
        + '<p>Registry 220-8170421. Owned by Weyland-Yutani Corp. A weathered Lockmart Bison hauling a lease-to-buy '
        + 'contract of refined Tritium along the Frontier under Captain Vanessa Miller. Runs a MU/TH/UR 6000 mainframe.</p>'
        + '<p>Mission: <em>Chariots of the Gods</em>.</p>',
      roster: [
        { match: 'Miller', position: 'CAPTAIN' },
        { match: 'Davis', position: 'PILOT' },
        { match: 'Cham', position: 'CARGO HANDLER' },
        { match: 'Wilson', position: 'CORPORATE LIAISON' },
        { match: 'Rye', position: 'TECHNICIAN' },
      ],
      items: [
        mod('CARGO HOLD', { size: 'Size IV', capacity: 'Bulk freight — 72 high-pressure Tritium tanks', comment: 'Primary internal cargo bay.' }),
        mod('CRYONICS BAY', { size: 'Size II', capacity: '7 hypersleep pods', comment: 'Crew hypersleep during long hauls.' }),
        mod('LIFE SUPPORT', { size: 'Size II', capacity: 'O2/CO2 recycling', comment: 'Standard atmosphere plant.' }),
        mod('ESCAPE PODS', { size: 'Size I', capacity: 'Emergency evac', comment: 'Lifeboat launch bays.' }),
      ],
    },
    {
      id: 'cronus',
      name: 'USCSS CRONUS',
      img: 'modules/wy-terminal/images/CRONUS.png',
      attributes: {
        manufacturer: 'Weyland-Yutani / USCM', model: 'C-CLASS MILITARY SCIENCE VESSEL',
        modules: '6 x Size IV, 8 x Size III, 10 x Size II',
        armaments: '1 x Size IV Rail Gun, 2 x Size III Missile Battery, Point-Defense Array',
        ai: 'MU/TH/UR 2000', crew: { value: 6 }, passengers: { value: 0 },
        length: { value: 385 }, ftlrating: { value: 10 }, signature: { value: 3 },
        thrusters: { value: 1 }, hull: { value: 12 }, armor: { value: 8 },
        damage: { value: 0 }, leasecost: { value: 'CLASSIFIED' },
      },
      notes: '<h1>USCSS CRONUS</h1><p><strong>C-CLASS MILITARY SCIENCE VESSEL</strong></p>'
        + '<p>Registry 110-4756891. Joint Weyland-Yutani / USCM asset. Adrift in the 26 Draconis System since 2111 '
        + 'after a classified expedition to LV-1113. Armed with a spinal rail gun, missile battery, and point-defense '
        + 'array; carries sealed science labs and a cryo vault. Runs a legacy MU/TH/UR 2000 mainframe.</p>'
        + '<p>Mission: <em>CLASSIFIED — LV-1113</em>.</p>',
      roster: [
        { match: 'Johns', position: 'SECOND OFFICER' },
        { match: 'Cooper', position: 'CHIEF SCIENTIST' },
        { match: 'Flynn', position: 'SHIP MEDIC' },
        { match: 'Clayton', position: 'CORPORATE LIAISON' },
        { match: 'Reid', position: 'SECURITY OFFICER' },
        { match: 'Ava', position: 'SCIENCE SYNTHETIC' },
      ],
      items: [
        weapon('RAIL GUN', { hardpoint: 'Size IV', damage: 4, bonus: 2, range: 4, quantity: 1, comment: 'Spinal-mounted mass driver. Armed — safety engaged.' }),
        weapon('MISSILE BATTERY', { hardpoint: 'Size III', damage: 3, bonus: 1, range: 3, quantity: 12, comment: '12 rounds loaded.' }),
        weapon('POINT-DEFENSE ARRAY', { hardpoint: 'Size II', damage: 1, bonus: 2, range: 1, quantity: 1, comment: 'Auto-tracking close-in defense system.' }),
        mod('SCIENCE POD (LAB-A / LAB-B)', { size: 'Size IV', capacity: 'Dual research laboratories', comment: 'Sealed biological/chemical research suite.' }),
        mod('CRYO VAULT', { size: 'Size III', capacity: 'Specimen cryo-suspension', comment: 'Reinforced Class-4 specimen storage.' }),
        mod('BIOHAZARD CARGO BAY', { size: 'Size IV', capacity: 'BSL-4 containment', comment: 'Chemical Agent A0-3959X.91-15 containment units.' }),
        mod('MED-LAB / SURGERY', { size: 'Size II', capacity: 'Surgical bay', comment: 'Bio-monitoring surgical tables.' }),
      ],
    },
  ];

  if (!skipConfirm) {
    const proceed = await _wyConfirm('Build Ship Actors',
      'Create/update the USCSS MONTERO and USCSS CRONUS spacecraft actors in "01. SHIPS" — with stats, art, weapon/module items, and crew linked from your world by name?');
    if (!proceed) return;
  }

  const folder = await _wyEnsureFolder('Actor', '01. SHIPS');
  let created = 0, updated = 0;
  const missingAll = [];

  try {
    for (const s of SHIPS) {
      const { occ, missing } = findCrew(s.roster);
      if (missing.length) missingAll.push(`${s.name}: ${missing.join(', ')}`);
      const system = {
        header: { type: { value: '', label: 'Text' } },
        attributes: s.attributes,
        general: { misc: { value: '' } },
        notes: { notes: s.notes },
        crew: { occupants: occ, passengerQty: 0 },
      };
      const existing = game.actors.find(a => a.type === 'spacecraft' && a.getFlag('wy-terminal', 'shipId') === s.id);
      if (existing) {
        await existing.update({
          name: s.name, img: s.img, system,
          'prototypeToken.texture.src': s.img, 'prototypeToken.name': s.name,
          'flags.wy-terminal.shipId': s.id,
        });
        const oldIds = existing.items.filter(i => ['spacecraftweapons', 'spacecraftmods'].includes(i.type)).map(i => i.id);
        if (oldIds.length) await existing.deleteEmbeddedDocuments('Item', oldIds);
        if (s.items.length) await existing.createEmbeddedDocuments('Item', s.items);
        updated++;
      } else {
        await Actor.createDocuments([{
          name: s.name, type: 'spacecraft', img: s.img, folder: folder?.id ?? null,
          system,
          prototypeToken: { name: s.name, actorLink: true, displayName: 20, disposition: 1, texture: { src: s.img } },
          items: s.items,
          flags: { 'wy-terminal': { shipId: s.id } },
        }]);
        created++;
      }
    }
    const warn = missingAll.length ? ` Unmatched crew — ${missingAll.join(' | ')}.` : '';
    ui.notifications.info(`WY-Terminal: Ship actors ready (${created} created, ${updated} updated).${warn}`);
    console.log(`WY-Terminal | buildShipActors: +${created}, ~${updated}.`, missingAll);
  } catch (e) {
    console.error('WY-Terminal | buildShipActors failed:', e);
    ui.notifications.error(`WY-Terminal: Could not build ship actors — ${e?.message || e}. Check console.`);
  }
}

/** Small confirm dialog helper that works across v13 (DialogV2) with fallbacks. */
async function _wyConfirm(title, content) {
  try {
    const D = foundry.applications?.api?.DialogV2;
    if (D?.confirm) {
      return await D.confirm({ window: { title }, content: `<p>${content}</p>`, modal: true, rejectClose: false });
    }
  } catch (_) { /* fall through */ }
  try { return await Dialog.confirm({ title, content: `<p>${content}</p>` }); } catch (_) { /* fall through */ }
  return window.confirm(content);
}

/** Ensure a world Folder of the given type/name exists; returns the Folder. */
async function _wyEnsureFolder(type, name) {
  let folder = game.folders.find(f => f.type === type && f.name === name);
  if (!folder) folder = await Folder.create({ name, type });
  return folder;
}

/**
 * Bulk-import AlienRPG compendium content into the current world (GM only).
 * @param {object} [opts]
 * @param {boolean} [opts.spacecraftOnly=false] Import only spacecraft actors.
 */
async function importAlienContent({ spacecraftOnly = false } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn('WY-Terminal: Only the GM can import content.');
    return;
  }
  const packs = game.packs.filter(p => {
    const pkg = (p.metadata?.packageName || '').toLowerCase();
    const id = (p.collection || '').toLowerCase();
    const isAlien = pkg.startsWith('alienrpg') || id.startsWith('alienrpg');
    if (!isAlien) return false;
    return spacecraftOnly ? p.documentName === 'Actor' : true;
  });
  if (!packs.length) {
    ui.notifications.error('WY-Terminal: No AlienRPG compendium packs found. Install/enable the AlienRPG modules first.');
    return;
  }

  const label = spacecraftOnly ? 'all SPACECRAFT actors' : `EVERYTHING from ${packs.length} AlienRPG compendium pack(s)`;
  const proceed = await _wyConfirm(
    'Import AlienRPG Content',
    `Import ${label} into this world? This can create many documents and may create duplicates if run more than once.`
  );
  if (!proceed) return;

  let total = 0;
  for (const pack of packs) {
    try {
      if (spacecraftOnly) {
        const index = await pack.getIndex({ fields: ['type'] });
        const ids = index.filter(e => e.type === 'spacecraft').map(e => e._id);
        if (!ids.length) continue;
        const folder = await _wyEnsureFolder('Actor', 'AlienRPG Spacecraft');
        const objs = [];
        for (const docId of ids) {
          const doc = await pack.getDocument(docId);
          if (!doc) continue;
          const obj = doc.toObject();
          delete obj._id;
          obj.folder = folder?.id ?? null;
          objs.push(obj);
        }
        const created = await Actor.createDocuments(objs);
        total += created.length;
      } else {
        const created = await pack.importAll({ folderName: pack.metadata.label });
        total += Array.isArray(created) ? created.length : 0;
      }
      console.log(`WY-Terminal | Imported from pack ${pack.collection}`);
    } catch (e) {
      console.error(`WY-Terminal | Import failed for pack ${pack.collection}:`, e);
    }
  }
  ui.notifications.info(`WY-Terminal: Imported ${total} document(s) from AlienRPG content.`);
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
      // GM pushed a scene change — update the active scene quietly.
      // Do NOT force the player away from their current view; only refresh
      // the SCHEMATICS view if the player is already looking at it.
      terminalApp.activeSceneId = data.payload.sceneId;
      if (terminalApp.activeView === 'scenes') {
        TerminalSFX.play('screenChange');
        terminalApp._renderView('scenes');
      }
    }
    if (data.type === 'refreshTokens' && terminalApp?.rendered) {
      // GM sent pre-computed token positions — apply them directly.
      // This avoids reading from local scene docs which may have stale data
      // if this socket message arrives before Foundry's own document sync.
      const { sceneId, tokens } = data.payload || {};
      if (terminalApp.activeView === 'scenes' && sceneId && sceneId === terminalApp.activeSceneId) {
        if (tokens && tokens.length > 0) {
          // Use GM-authoritative positions (debounced internally)
          terminalApp.scheduleTokenUpdate(tokens);
        } else {
          // Fallback: no tokens in payload — read from local scene data after delay
          terminalApp.scheduleTokenUpdate(null);
        }
      } else if (terminalApp.activeView === 'sensors' && sceneId && sceneId === terminalApp._sensorsDeckId) {
        // INTERNAL sensors re-reads local scene tokens on re-render
        terminalApp._renderView('sensors');
      }
    }
    // Player requests to move a token they can't directly update —
    // GM performs the update on their behalf
    if (data.type === 'moveToken' && game.user.isGM) {
      const { sceneId, tokenId, x, y } = data.payload || {};
      const scene = game.scenes?.get(sceneId);
      const tokenDoc = scene?.tokens?.get(tokenId);
      if (tokenDoc) {
        tokenDoc.update({ x: Math.round(x), y: Math.round(y) }).then(() => {
          console.log(`WY-Terminal | GM executed player-requested token move: ${tokenId}`);
        }).catch(err => {
          console.warn('WY-Terminal | Failed to execute player token move:', err);
        });
      }
    }
    if (data.type === 'setCourse' && game.user.isGM) {
      // Player requested a NAV course — only the GM writes navData + drives the ship.
      terminalApp?._setNavCourse?.(data.payload);
    }
    if (data.type === 'setCourseSpeed' && game.user.isGM) {
      // Player adjusted throttle — GM applies the new active-course speed.
      terminalApp?._navSetCourseSpeed?.(data.payload?.speed);
    }
    if (data.type === 'setCommandedSpeed' && game.user.isGM) {
      // Player set commanded cruise speed (no active course) — GM writes it.
      terminalApp?._navSetCommandedSpeed?.(data.payload?.speed);
    }
    if (data.type === 'shipSwitch' && terminalApp?.rendered) {
      // GM switched ship profile — full re-render to pick up new theme, nav, and data
      console.log(`WY-Terminal | Ship switched to ${data.payload.shipName} — refreshing terminal`);
      terminalApp.activeView = 'status';
      TerminalSFX.play('boot');
      terminalApp.render(true);
    }
    // Player requests clearance change — only GM writes the setting (per-user)
    if (data.type === 'setClearance' && game.user.isGM) {
      const level = data.payload?.level;
      const userId = data.payload?.userId;
      if (level && userId && WYTerminalApp.CLEARANCE_RANK?.[level] !== undefined) {
        const levels = game.settings.get('wy-terminal', 'userClearanceLevels') || {};
        if (levels[userId] !== level) {
          levels[userId] = level;
          game.settings.set('wy-terminal', 'userClearanceLevels', levels).then(() => {
            console.log(`WY-Terminal | Clearance for user ${userId} set to ${level}`);
            // Broadcast to all clients so the target user updates their footer
            game.socket.emit('module.wy-terminal', {
              type: 'clearanceUpdated',
              payload: { level, userId },
            });
            // Update GM's own terminal if open
            if (terminalApp?.rendered) {
              if (userId === game.user.id) {
                terminalApp._updateFooterClearance(level);
              }
              // Re-render GM's CMD CODE view to reflect updated user states
              if (terminalApp.activeView === 'commandcode') {
                terminalApp._renderView('commandcode');
              }
            }
          });
        }
      }
    }
    // Clearance was updated by GM — target user updates their footer and re-renders
    if (data.type === 'clearanceUpdated' && terminalApp?.rendered) {
      const { level, userId } = data.payload;
      // Only update footer if this clearance change is for the current user
      if (userId === game.user.id) {
        terminalApp._updateFooterClearance(level);
      }
      // Re-render current view (player sees updated access, GM sees updated user list)
      terminalApp._renderView(terminalApp.activeView);
    }
    // Player requests frequency change — only GM writes the setting
    if (data.type === 'setCommFrequency' && game.user.isGM) {
      const freq = data.payload?.frequency;
      if (freq && /^\d{3}\.\d{2}$/.test(freq)) {
        game.settings.set('wy-terminal', 'commFrequency', freq).then(() => {
          console.log(`WY-Terminal | Comm frequency set to ${freq} MHz (requested by player)`);
          // Broadcast refresh so all clients see the new frequency
          game.socket.emit('module.wy-terminal', {
            type: 'refreshView',
            payload: { view: 'comms' },
          });
        });
      }
    }
    // View refresh broadcast — re-render if currently on that view
    if (data.type === 'refreshView' && terminalApp?.rendered) {
      const view = data.payload?.view;
      if (view === 'all') {
        terminalApp.render(true);
      } else if (view && terminalApp.activeView === view) {
        terminalApp._renderView(view);
      }
    }
    // New log alert — flash the LOGS nav button for non-GM users
    if (data.type === 'newLogAlert' && terminalApp?.rendered && !game.user.isGM) {
      console.log('WY-Terminal | newLogAlert received — flashing LOGS button');
      const el = terminalApp.element[0] ?? terminalApp.element;
      const logsBtn = el?.querySelector('[data-view="logs"]');
      if (logsBtn && !logsBtn.classList.contains('wy-nav-flash')) {
        logsBtn.classList.add('wy-nav-flash');
        TerminalSFX.play('beep');
      }
    }
    // Emergency protocol activated — flash STATUS button, play alarm, show alert
    if (data.type === 'emergencyActivated' && terminalApp?.rendered) {
      const { protocol, message } = data.payload;
      console.log(`WY-Terminal | Emergency activated: ${protocol}`);

      // Show persistent alert
      terminalApp.showAlert(message, 0);

      // Play alarm sound on player terminals
      if (!game.user.isGM) {
        TerminalSFX.play('emergency');

        // Flash the STATUS nav button
        terminalApp._flashStatusButton();

        // Start computer voice warnings — repeating every 60 real seconds
        if (protocol === 'self-destruct') {
          // Self-destruct uses its own countdown-aware voice system
          terminalApp._startSelfDestructVoice();
        } else {
          // All other protocols: build spoken warning from alert message
          const voiceText = `WARNING. ${message}. ALL PERSONNEL RESPOND ACCORDINGLY.`;
          terminalApp._startEmergencyVoice(protocol, voiceText);
        }

        // Evacuation: also play alarm
        if (protocol === 'evacuate') {
          TerminalSFX.play('alert');
        }
      }

      // Refresh status and emergency views if currently viewing
      if (terminalApp.activeView === 'status') terminalApp._renderView('status');
      if (terminalApp.activeView === 'emergency') terminalApp._renderView('emergency');
    }
    // Emergency protocol cancelled — stop voice, clear flash if no emergencies remain
    if (data.type === 'emergencyCancelled' && terminalApp?.rendered) {
      const { protocol, anyRemaining } = data.payload;
      console.log(`WY-Terminal | Emergency cancelled: ${protocol}, anyRemaining: ${anyRemaining}`);

      if (!game.user.isGM) {
        // Stop voice warnings for the cancelled protocol
        if (protocol === 'self-destruct') {
          terminalApp._clearSelfDestructVoice();
          // Announce abort via voice
          terminalApp._speakWarning('ATTENTION. SELF-DESTRUCT SEQUENCE HAS BEEN ABORTED. RESUME NORMAL OPERATIONS.');
        } else {
          terminalApp._clearEmergencyVoice(protocol);
        }

        // Use GM-authoritative flag — local shipStatus may be stale
        if (!anyRemaining) {
          terminalApp._clearAllEmergencyVoices();
          const el = terminalApp.element?.[0] ?? terminalApp.element;
          el?.querySelector('[data-view="status"]')?.classList.remove('wy-nav-flash-red');
          terminalApp.hideAlert();
        }
      }

      // Refresh views
      if (terminalApp.activeView === 'status') terminalApp._renderView('status');
      if (terminalApp.activeView === 'emergency') terminalApp._renderView('emergency');
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
Hooks.on('updateToken', (token, change) => {
  // Only broadcast when position or visibility changed (skip name edits, etc.)
  if ('x' in change || 'y' in change || 'hidden' in change ||
      'width' in change || 'height' in change || 'texture' in change ||
      'disposition' in change) {
    _broadcastTokenRefresh(token.parent);
  }
});
Hooks.on('deleteToken', (token) => {
  _broadcastTokenRefresh(token.parent);
});

function _broadcastTokenRefresh(scene) {
  if (!scene) return;

  // GM pre-computes token positions and sends them in the socket payload.
  // This means player clients get authoritative positions immediately
  // without needing to wait for Foundry's document sync to complete.
  if (game.user.isGM) {
    let tokens = [];
    if (terminalApp) {
      try {
        tokens = terminalApp._getSceneTokens(scene);
      } catch (err) {
        console.warn('WY-Terminal | Failed to compute token positions for socket:', err);
      }
    }
    game.socket.emit('module.wy-terminal', {
      type: 'refreshTokens',
      payload: { sceneId: scene.id, tokens },
    });
  }

  // Also refresh locally (GM's own terminal, or player hook backup).
  // Use debounced schedule to coalesce rapid successive updates.
  if (terminalApp?.rendered) {
    if (terminalApp.activeView === 'scenes' && terminalApp.activeSceneId === scene.id) {
      terminalApp.scheduleTokenUpdate(null);
    } else if (terminalApp.activeView === 'sensors' && terminalApp._sensorsDeckId === scene.id) {
      terminalApp._renderView('sensors');
    }
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

/* ──────────────────────────────────────────────────────────────────
   Actor Sheet Injection — Ship Assignment Field
   ────────────────────────────────────────────────────────────────── */

/**
 * Inject a "Ship Assignment" dropdown into AlienRPG character/synthetic
 * actor sheets so the GM can assign crew to ships directly from the
 * Actor sidebar.  Works with both ApplicationV1 (jQuery) and V2 (HTMLElement).
 */
function _injectShipAssignment(app, html) {
  const actor = app.actor || app.document;
  if (!actor || (actor.type !== 'character' && actor.type !== 'synthetic')) return;
  if (!game.user.isGM) return;

  try {
    // Normalise to raw HTMLElement (v1 passes jQuery, v2 passes HTMLElement)
    const el = html instanceof HTMLElement ? html : (html[0] ?? html);
    if (!el || !(el instanceof HTMLElement)) return;

    // Guard against double-injection (re-render)
    if (el.querySelector('.wy-ship-assign-row')) return;

    const currentShip = actor.getFlag('wy-terminal', 'shipAssignment') || '';
    const profiles = getAvailableProfiles();

    const options = profiles.map(p =>
      `<option value="${p.id}"${p.id === currentShip ? ' selected' : ''}>${p.label}</option>`
    ).join('');

    const fieldHtml = `
      <div class="wy-ship-assign-row" style="
        display: flex; align-items: center; gap: 6px;
        padding: 4px 8px; margin: 4px 0;
        border: 1px solid rgba(58,122,0,0.3);
        background: rgba(0,10,0,0.3);
        font-family: 'Share Tech Mono', monospace;
        font-size: 12px; color: #3a7a00;
      ">
        <label style="flex-shrink:0; letter-spacing:1px; font-size:11px; color:#3a7a00;">⛴ SHIP ASSIGNMENT</label>
        <select class="wy-ship-assign-select" style="
          flex: 1; background: rgba(0,10,0,0.6); color: #3a7a00;
          border: 1px solid rgba(58,122,0,0.3); font-family: inherit;
          font-size: 12px; padding: 2px 4px; height: 26px;
        ">
          <option value=""${!currentShip ? ' selected' : ''}>— UNASSIGNED —</option>
          ${options}
        </select>
      </div>
    `;

    // Find injection point — try several selectors for AlienRPG / generic sheets
    const selectors = [
      '.header-fields',
      '.sheet-header',
      '.charheader',
      'header.sheet-header',
      '.window-content > form > header',
      '.window-content > form',
      '.sheet-body',
      '.window-content',
    ];

    let target = null;
    let insertMode = 'after'; // 'after' = insertAdjacentHTML afterend, 'prepend' = afterbegin
    for (const sel of selectors) {
      target = el.querySelector(sel);
      if (target) {
        // For form/body/window-content, prepend instead of after
        if (sel === '.window-content > form' || sel === '.sheet-body' || sel === '.window-content') {
          insertMode = 'prepend';
        }
        break;
      }
    }

    if (target) {
      target.insertAdjacentHTML(
        insertMode === 'prepend' ? 'afterbegin' : 'afterend',
        fieldHtml
      );
    } else {
      // Last resort: append to the element itself
      el.insertAdjacentHTML('afterbegin', fieldHtml);
    }

    // Bind change handler
    const select = el.querySelector('.wy-ship-assign-select');
    if (select) {
      select.addEventListener('change', async () => {
        const newVal = select.value;
        if (newVal) {
          await actor.setFlag('wy-terminal', 'shipAssignment', newVal);
        } else {
          await actor.unsetFlag('wy-terminal', 'shipAssignment');
        }
        const shipLabel = newVal ? (SHIP_PROFILES[newVal]?.name || newVal.toUpperCase()) : 'UNASSIGNED';
        ui.notifications.info(`WY-Terminal: ${actor.name} assigned to ${shipLabel}`);
      });
    }

    console.log(`WY-Terminal | Ship Assignment field injected for ${actor.name}`);
  } catch (err) {
    console.error('WY-Terminal | Failed to inject Ship Assignment field:', err);
  }
}

// Hook both v1 and v2 render patterns to cover all AlienRPG sheet versions
Hooks.on('renderActorSheet', (app, html, data) => _injectShipAssignment(app, html));
Hooks.on('renderDocumentSheet', (app, html) => {
  // Only fire for actor documents (avoid items, journals, etc.)
  const doc = app.actor || app.document;
  if (doc?.documentName === 'Actor') _injectShipAssignment(app, html);
});
