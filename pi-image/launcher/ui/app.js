/**
 * AlienPi launcher — main controller.
 *
 * Drives the boot sequence, view navigation, WiFi, game discovery, manual
 * connect, touch test, and reboot-to-return. Talks to the Rust backend via
 * Tauri's global `invoke` (withGlobalTauri = true).
 */
(function () {
  const invoke = (cmd, args) => window.__TAURI__?.core?.invoke(cmd, args);

  /* ---------------------------------------------------------------- views */
  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('is-active', v.dataset.view === name);
    });
    window.SFX?.play('screenChange');
    if (name === 'games') discoverGames();
    if (name === 'wifi') scanWifi();
  }

  /* ---------------------------------------------------------------- boot */
  const BOOT_LINES = [
    'WEYLAND-YUTANI CORP // INTERFACE 2037',
    '',
    'MU/TH/UR 9000 MAINFRAME .......... ONLINE',
    'MEMORY CORE ...................... 24576 KB OK',
    'NEUROGRID ........................ SYNCED',
    'INPUT SUBSYSTEM .................. TOUCH ENABLED',
    'NETWORK INTERFACE ................ INITIALISING',
    'SESSION DISCOVERY DAEMON ......... READY',
    '',
    'ALL SYSTEMS NOMINAL. STANDING BY.',
  ];

  async function runBoot() {
    const logEl = document.getElementById('boot-log');
    window.SFX?.play('boot');
    for (const line of BOOT_LINES) {
      logEl.textContent += line + '\n';
      if (line.trim()) window.SFX?.play('key', { volume: 0.15 });
      await sleep(line.trim() ? 260 : 90);
    }
    await sleep(700);
    showView('menu');
  }

  /* ----------------------------------------------------------- clock/net */
  function tickClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    document.getElementById('clock').textContent =
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  async function refreshNet() {
    const ind = document.getElementById('net-indicator');
    try {
      const ssid = await invoke('wifi_status');
      if (ssid) {
        ind.textContent = `◉ ${ssid}`;
        ind.className = 'net net--up';
      } else {
        ind.textContent = '◍ NO LINK';
        ind.className = 'net net--down';
      }
    } catch {
      ind.textContent = '◍ NO LINK';
      ind.className = 'net net--down';
    }
  }

  /* ---------------------------------------------------------- discovery */
  async function discoverGames() {
    const status = document.getElementById('games-status');
    const list = document.getElementById('games-list');
    status.textContent = 'SCANNING LOCAL NETWORK FOR ACTIVE SESSIONS…';
    list.innerHTML = '';
    window.SFX?.play('rattle');

    try {
      const servers = await invoke('discover_games');
      window.SFX?.play('printer');
      if (!servers || servers.length === 0) {
        status.textContent = 'NO ACTIVE SESSIONS FOUND. USE MANUAL / DIRECT ADDRESS.';
        return;
      }
      status.textContent = `${servers.length} INTERFACE(S) LOCATED`;
      servers.forEach((s) => list.appendChild(gameItem(s)));
    } catch (err) {
      status.textContent = `SCAN FAULT: ${err}`;
      window.SFX?.play('buzz');
    }
  }

  function gameItem(s) {
    const li = document.createElement('li');
    li.className = 'list-item';
    const meta = [];
    if (s.system) meta.push(s.system);
    if (typeof s.users === 'number') meta.push(`${s.users} CREW`);
    meta.push(`${s.host}:${s.port}`);
    li.innerHTML = `
      <div>
        <div>${escapeHtml(s.name)}</div>
        <div class="meta">${meta.map(escapeHtml).join(' · ')}</div>
      </div>
      <span class="badge badge--${s.source}">${s.source.toUpperCase()}</span>`;
    li.addEventListener('pointerup', () => connect(s.host, s.port, s.name));
    return li;
  }

  /* --------------------------------------------------------------- wifi */
  async function scanWifi() {
    const status = document.getElementById('wifi-status');
    const list = document.getElementById('wifi-list');
    status.textContent = 'SCANNING FOR NETWORKS…';
    list.innerHTML = '';
    window.SFX?.play('rattle');

    try {
      const nets = await invoke('wifi_scan');
      window.SFX?.play('printer');
      if (!nets || nets.length === 0) {
        status.textContent = 'NO NETWORKS DETECTED.';
        return;
      }
      status.textContent = `${nets.length} NETWORK(S) DETECTED`;
      nets.forEach((n) => list.appendChild(wifiItem(n)));
    } catch (err) {
      status.textContent = `SCAN FAULT: ${err}`;
      window.SFX?.play('buzz');
    }
  }

  function wifiItem(n) {
    const li = document.createElement('li');
    li.className = 'list-item';
    const bars = signalBars(n.signal);
    const locked = n.security && n.security !== 'OPEN';
    li.innerHTML = `
      <div>
        <div>${escapeHtml(n.ssid)} ${n.in_use ? '◉' : ''}</div>
        <div class="meta">${escapeHtml(n.security)} · ${n.signal}%</div>
      </div>
      <div>
        <span class="signal-bars">${bars}</span>
        ${locked ? '<span class="lock">🔒</span>' : ''}
      </div>`;
    li.addEventListener('pointerup', () => promptWifi(n));
    return li;
  }

  function signalBars(signal) {
    const level = Math.min(4, Math.floor(signal / 25) + 1);
    return '▮'.repeat(level) + '▯'.repeat(4 - level);
  }

  function promptWifi(n) {
    const locked = n.security && n.security !== 'OPEN';
    if (!locked) {
      doWifiConnect(n.ssid, '');
      return;
    }
    openModal(`CONNECT: ${n.ssid}`, `
      <label class="field">
        <span class="field-label">PASSPHRASE</span>
        <input class="field-input" id="wifi-pass" type="password" inputmode="none" />
      </label>`, [
      { label: 'CANCEL', action: closeModal },
      {
        label: '◆ CONNECT',
        primary: true,
        action: () => {
          const pass = document.getElementById('wifi-pass').value;
          closeModal();
          doWifiConnect(n.ssid, pass);
        },
      },
    ]);
    setTimeout(() => document.getElementById('wifi-pass')?.focus(), 50);
  }

  async function doWifiConnect(ssid, pass) {
    const status = document.getElementById('wifi-status');
    status.textContent = `LINKING TO ${ssid}…`;
    try {
      const msg = await invoke('wifi_connect', { ssid, password: pass });
      status.textContent = msg;
      window.SFX?.play('beep');
      refreshNet();
    } catch (err) {
      status.textContent = `LINK FAILED: ${err}`;
      window.SFX?.play('buzz');
    }
  }

  /* ------------------------------------------------------------- manual */
  async function manualConnect(e) {
    e.preventDefault();
    const host = document.getElementById('manual-host').value.trim();
    const port = parseInt(document.getElementById('manual-port').value, 10) || 30000;
    const status = document.getElementById('manual-status');
    if (!host) {
      status.textContent = 'ENTER A HOST OR IP ADDRESS.';
      window.SFX?.play('buzz');
      return;
    }
    status.textContent = `PROBING ${host}:${port}…`;
    try {
      const s = await invoke('probe_status', { host, port });
      status.textContent = `FOUND: ${s.name}`;
      window.SFX?.play('beep');
      connect(host, port, s.name);
    } catch (err) {
      // Even if probe fails, allow a direct connect attempt.
      status.textContent = `${err} — CONNECTING ANYWAY…`;
      window.SFX?.play('buzz');
      connect(host, port, `${host}:${port}`);
    }
  }

  /* ------------------------------------------------------------ connect */
  function connect(host, port, name) {
    openModal('LAUNCH INTERFACE', `
      <div>Open <strong>${escapeHtml(name)}</strong> in full-screen kiosk?</div>
      <div class="meta">${escapeHtml(host)}:${port}</div>`, [
      { label: 'CANCEL', action: closeModal },
      {
        label: '◆ CONNECT',
        primary: true,
        action: async () => {
          closeModal();
          window.SFX?.play('alert');
          try {
            await invoke('launch_game', { host, port });
          } catch (err) {
            openAlert(`LAUNCH FAILED: ${err}`);
          }
        },
      },
    ]);
  }

  /* ------------------------------------------------------------ restart */
  function restart() {
    openModal('RESTART TERMINAL', `
      <div>This will reboot the terminal and end any active session.</div>
      <div class="meta">Used to return from a game or change networks.</div>`, [
      { label: 'CANCEL', action: closeModal },
      {
        label: '!! RESTART',
        primary: true,
        danger: true,
        action: async () => {
          closeModal();
          window.SFX?.play('alert');
          try {
            await invoke('restart_terminal');
          } catch (err) {
            openAlert(`RESTART FAILED: ${err}`);
          }
        },
      },
    ]);
  }

  /* -------------------------------------------------------- touch test */
  function initTouchTest() {
    const pad = document.getElementById('touch-pad');
    const status = document.getElementById('touch-status');
    const dots = new Map();

    const upsert = (id, x, y) => {
      let dot = dots.get(id);
      if (!dot) {
        dot = document.createElement('div');
        dot.className = 'touch-dot';
        dot.dataset.id = id;
        pad.appendChild(dot);
        dots.set(id, dot);
        window.SFX?.play('key', { volume: 0.2 });
      }
      const rect = pad.getBoundingClientRect();
      dot.style.left = `${x - rect.left}px`;
      dot.style.top = `${y - rect.top}px`;
      status.textContent = `ACTIVE CONTACT POINTS: ${dots.size}`;
    };
    const remove = (id) => {
      const dot = dots.get(id);
      if (dot) {
        dot.remove();
        dots.delete(id);
      }
      status.textContent = dots.size
        ? `ACTIVE CONTACT POINTS: ${dots.size}`
        : 'TOUCH THE PANEL — EACH CONTACT POINT IS TRACKED';
    };

    pad.addEventListener('pointerdown', (e) => upsert(e.pointerId, e.clientX, e.clientY));
    pad.addEventListener('pointermove', (e) => {
      if (dots.has(e.pointerId)) upsert(e.pointerId, e.clientX, e.clientY);
    });
    pad.addEventListener('pointerup', (e) => remove(e.pointerId));
    pad.addEventListener('pointercancel', (e) => remove(e.pointerId));
  }

  /* --------------------------------------------------------------- modal */
  function openModal(title, bodyHtml, actions) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    const actionsEl = document.getElementById('modal-actions');
    actionsEl.innerHTML = '';
    actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (a.danger ? ' btn--danger' : '');
      btn.textContent = a.label;
      btn.addEventListener('pointerup', () => {
        window.SFX?.play('beep');
        a.action();
      });
      actionsEl.appendChild(btn);
    });
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function openAlert(msg) {
    openModal('NOTICE', `<div>${escapeHtml(msg)}</div>`, [
      { label: 'OK', action: closeModal },
    ]);
    window.SFX?.play('buzz');
  }
  function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  /* -------------------------------------------------------------- utils */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const LOGO = String.raw`
   ____    __    __  ____  __ __
  |    \  |  |__|  ||    ||  |  |
  |  D  ) |  |  |  | |  | |  |  |
  |    /  |  |  |  | |  | |  ~  |
  |    \  |  '  '  | |  | |___, |
  |  .  \  \      /  |  | |     |
  |__|\_|   \_/\_/  |____||____/
     M U / T H / U R   9 0 0 0`;

  /* --------------------------------------------------------------- init */
  document.addEventListener('DOMContentLoaded', () => {
    window.SFX?.preload();
    document.getElementById('brand-logo').textContent = LOGO;

    // Global action delegation.
    document.body.addEventListener('pointerup', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action !== 'goto') window.SFX?.play('beep');
      switch (action) {
        case 'goto': showView(btn.dataset.target); break;
        case 'discover': discoverGames(); break;
        case 'wifi-scan': scanWifi(); break;
        case 'restart': restart(); break;
      }
    });

    document.getElementById('manual-form').addEventListener('submit', manualConnect);

    initTouchTest();
    tickClock();
    setInterval(tickClock, 1000);
    refreshNet();
    setInterval(refreshNet, 15000);

    runBoot();
  });
})();
