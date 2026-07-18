/**
 * NAV star-chart geometry + renderer.
 *
 * Shared by the terminal's live NAV canvas and the GM `setupNavScene()` helper
 * (which bakes the same chart into a Foundry scene background PNG) so the two
 * always line up.
 *
 * Coordinate model: Alien RPG "Middle Heavens" — Sol at 0,0, X = Spinward(+) /
 * Antispinward(−), Y = Coreward(+, up) / Rimward(−, down). 1 grid square = 1
 * unit; the chart spans −25…+25 on both axes. Sol sits on the centre grid
 * intersection.
 */

/** Fixed chart geometry. Keep in sync with `setupNavScene()` scene config. */
export const NAV_CHART = {
  sizePx: 3200,   // scene canvas is square 3200×3200
  gridPx: 32,     // 32 px per grid square = 1 unit
  halfLy: 50,     // scene spans −50…+50 on both axes (holds all known systems)
  spanLy: 100,    // total units across the scene
};

/**
 * Terminal NAV view model. The Foundry SCENE holds the core worlds at ±coreHalfAu,
 * but the terminal chart can zoom/scroll out to ±chartHalfAu of open space.
 */
export const NAV_VIEW = {
  chartHalfAu: 400,   // navigable field extent (± on both axes)
  coreHalfAu: 25,     // token-bearing scene extent (± on both axes)
};

/** Deterministic PRNG so the starfield is stable across renders. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap 32-bit string hash for seeding per-system planet art. */
export function hashString(str) {
  let h = 0x811c9dc5;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Render a monochrome green-phosphor planet onto a (transparent) square canvas
 * context, seeded by name so each system looks distinct but stable.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size  square canvas size in px
 * @param {string} seedStr  seed (e.g. system name)
 */
export function drawPlanetImage(ctx, size, seedStr) {
  const rnd = mulberry32(hashString(seedStr));
  const c = size / 2;
  const R = size * 0.46;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.clip();

  // Sphere base — lit from upper-left
  const base = ctx.createRadialGradient(c - R * 0.35, c - R * 0.35, R * 0.1, c, c, R);
  base.addColorStop(0, 'rgba(170,255,140,0.98)');
  base.addColorStop(0.55, 'rgba(64,196,48,0.95)');
  base.addColorStop(1, 'rgba(8,54,10,0.98)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Surface "continents" / features
  const blobs = 6 + Math.floor(rnd() * 9);
  for (let i = 0; i < blobs; i++) {
    const bx = c + (rnd() * 2 - 1) * R * 0.85;
    const by = c + (rnd() * 2 - 1) * R * 0.85;
    const br = R * (0.08 + rnd() * 0.34);
    const g = 90 + Math.floor(rnd() * 130);
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(18, ${g}, 24, ${0.12 + rnd() * 0.35})`;
    ctx.fill();
  }

  // Terminator shadow on the trailing edge
  const sh = ctx.createLinearGradient(c - R, 0, c + R, 0);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(0.7, 'rgba(0,16,0,0.15)');
  sh.addColorStop(1, 'rgba(0,20,0,0.7)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // Atmosphere rim
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(160,255,140,0.55)';
  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.stroke();
}

/** Convert light-year coordinates to chart pixel coordinates (Sol = centre). */
export function lyToPixel(spinward, coreward, size = NAV_CHART.sizePx, gridPx = NAV_CHART.gridPx) {
  const c = size / 2;
  return { x: c + spinward * gridPx, y: c - coreward * gridPx };
}

/** Convert chart pixel coordinates to light-year coordinates (Sol = centre). */
export function pixelToLy(px, py, size = NAV_CHART.sizePx, gridPx = NAV_CHART.gridPx) {
  const c = size / 2;
  return { spinward: (px - c) / gridPx, coreward: (c - py) / gridPx };
}

/** Format a light-year coordinate pair the Middle Heavens way. */
export function formatLyCoord(spinward, coreward) {
  const sp = spinward >= 0
    ? `${spinward.toFixed(1)} SPINWARD`
    : `${Math.abs(spinward).toFixed(1)} ANTISPINWARD`;
  const co = coreward >= 0
    ? `${coreward.toFixed(1)} COREWARD`
    : `${Math.abs(coreward).toFixed(1)} RIMWARD`;
  return `${co} / ${sp}`;
}

/**
 * Draw the green-phosphor star chart onto a 2D context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{size?:number, gridPx?:number}} [opts]
 */
export function drawNavStarChart(ctx, opts = {}) {
  const size = opts.size ?? NAV_CHART.sizePx;
  const gridPx = opts.gridPx ?? NAV_CHART.gridPx;
  const half = NAV_CHART.halfLy;
  const c = size / 2;

  // Background
  ctx.fillStyle = '#000400';
  ctx.fillRect(0, 0, size, size);

  // Seeded starfield
  const rnd = mulberry32(0x5157a);
  const starCount = Math.floor((size * size) / 5200);
  for (let i = 0; i < starCount; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = rnd() * 1.4 + 0.2;
    const b = 0.2 + rnd() * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = rnd() < 0.14 ? `rgba(190,255,190,${b})` : `rgba(127,255,0,${b * 0.55})`;
    ctx.fill();
  }

  // Minor grid (every 1 LY)
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(127,255,0,0.10)';
  ctx.beginPath();
  for (let ly = -half; ly <= half; ly++) {
    const x = c + ly * gridPx;
    ctx.moveTo(x, 0); ctx.lineTo(x, size);
    const y = c - ly * gridPx;
    ctx.moveTo(0, y); ctx.lineTo(size, y);
  }
  ctx.stroke();

  // Major grid (every 5 LY)
  ctx.strokeStyle = 'rgba(127,255,0,0.28)';
  ctx.beginPath();
  for (let ly = -half; ly <= half; ly += 5) {
    const x = c + ly * gridPx;
    ctx.moveTo(x, 0); ctx.lineTo(x, size);
    const y = c - ly * gridPx;
    ctx.moveTo(0, y); ctx.lineTo(size, y);
  }
  ctx.stroke();

  // Axes through Sol
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(127,255,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(0, c); ctx.lineTo(size, c);
  ctx.moveTo(c, 0); ctx.lineTo(c, size);
  ctx.stroke();

  // Coordinate numbers every 5 LY
  ctx.fillStyle = 'rgba(127,255,0,0.65)';
  ctx.font = `${Math.round(gridPx * 0.28)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let ly = -half; ly <= half; ly += 5) {
    if (ly === 0) continue;
    const x = c + ly * gridPx;
    ctx.fillText(String(ly), x, c - gridPx * 0.4);
    const y = c - ly * gridPx;
    ctx.fillText(String(ly), c + gridPx * 0.45, y);
  }

  // Axis labels
  ctx.fillStyle = 'rgba(127,255,0,0.45)';
  ctx.font = `${Math.round(gridPx * 0.30)}px monospace`;
  ctx.textAlign = 'right';
  ctx.fillText('SPINWARD +', c + half * gridPx - gridPx * 0.3, c - gridPx * 0.9);
  ctx.textAlign = 'left';
  ctx.fillText('+ COREWARD', c + gridPx * 0.5, c - half * gridPx + gridPx * 0.9);

  // Sol at the origin
  const glow = ctx.createRadialGradient(c, c, 1, c, c, gridPx * 0.6);
  glow.addColorStop(0, 'rgba(255,240,150,0.95)');
  glow.addColorStop(1, 'rgba(255,180,0,0.03)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c, c, gridPx * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,235,140,0.98)';
  ctx.beginPath();
  ctx.arc(c, c, gridPx * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,225,130,0.95)';
  ctx.font = `bold ${Math.round(gridPx * 0.30)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('SOL', c, c + gridPx * 0.7);
}

/**
 * Generate a stable, seeded starfield in AU space (spread across the full
 * navigable field) so stars pan/zoom coherently with the chart.
 * @returns {Array<{x:number,y:number,r:number,b:number,bright:boolean}>}
 */
export function generateNavStars(count = 900, halfAu = NAV_VIEW.chartHalfAu) {
  const rnd = mulberry32(0x5157a);
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (rnd() * 2 - 1) * halfAu,
      y: (rnd() * 2 - 1) * halfAu,
      r: rnd() * 1.3 + 0.3,
      b: 0.2 + rnd() * 0.6,
      bright: rnd() < 0.14,
    });
  }
  return stars;
}

/** Format an AU coordinate pair as signed, zero-padded triples: "(-005 +012)". */
export function formatNavCoord(auX, auY) {
  const pad = (v) => {
    const n = Math.round(v);
    return (n < 0 ? '-' : '+') + String(Math.abs(n)).padStart(3, '0');
  };
  return `(${pad(auX)} ${pad(auY)})`;
}

/** Draw a compact SOL marker at the given screen pixel (fixed screen size). */
function drawSolMarker(ctx, px, py) {
  const glow = ctx.createRadialGradient(px, py, 1, px, py, 16);
  glow.addColorStop(0, 'rgba(255,240,150,0.95)');
  glow.addColorStop(1, 'rgba(255,180,0,0.02)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(px, py, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,235,140,0.98)';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,225,130,0.95)';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('SOL', px, py + 8);
}

/**
 * Level-of-detail NAV grid renderer. Draws the black field, seeded starfield,
 * an adaptive coordinate grid (spacing chosen so cells stay readable at the
 * current zoom), axes through Sol, zero-padded corner coordinate labels, the
 * ±chartHalfAu boundary, and the SOL marker.
 *
 * @param {CanvasRenderingContext2D} ctx  Context pre-scaled to CSS pixels.
 * @param {{w:number,h:number,cx:number,cy:number,pxPerAu:number,stars:Array,chartHalfAu?:number}} view
 */
export function drawNavGrid(ctx, view) {
  const { w, h, cx, cy, pxPerAu, stars } = view;
  const chartHalfAu = view.chartHalfAu ?? NAV_VIEW.chartHalfAu;
  const toX = (au) => w / 2 + (au - cx) * pxPerAu;
  const toY = (au) => h / 2 - (au - cy) * pxPerAu;

  ctx.fillStyle = '#000400';
  ctx.fillRect(0, 0, w, h);

  // Starfield (only draw those on screen)
  if (stars) {
    for (const s of stars) {
      const x = toX(s.x);
      const y = toY(s.y);
      if (x < -4 || x > w + 4 || y < -4 || y > h + 4) continue;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.bright ? `rgba(190,255,190,${s.b})` : `rgba(127,255,0,${s.b * 0.55})`;
      ctx.fill();
    }
  }

  // Choose an adaptive step so labelled cells are ≥ ~72 px on screen.
  const STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500];
  let labelStep = STEPS.find(s => s * pxPerAu >= 72) || 500;
  labelStep = Math.max(5, labelStep);
  const minorStep = Math.max(1, labelStep / 5);

  const clamp = (v) => Math.max(-chartHalfAu, Math.min(chartHalfAu, v));
  const auL = clamp(cx - (w / 2) / pxPerAu);
  const auR = clamp(cx + (w / 2) / pxPerAu);
  const auB = clamp(cy - (h / 2) / pxPerAu);
  const auT = clamp(cy + (h / 2) / pxPerAu);

  const lineTop = toY(auT);
  const lineBot = toY(auB);
  const lineLeft = toX(auL);
  const lineRight = toX(auR);

  // Minor grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(127,255,0,0.08)';
  ctx.beginPath();
  for (let a = Math.ceil(auL / minorStep) * minorStep; a <= auR; a += minorStep) {
    const x = toX(a); ctx.moveTo(x, lineTop); ctx.lineTo(x, lineBot);
  }
  for (let a = Math.ceil(auB / minorStep) * minorStep; a <= auT; a += minorStep) {
    const y = toY(a); ctx.moveTo(lineLeft, y); ctx.lineTo(lineRight, y);
  }
  ctx.stroke();

  // Major grid
  ctx.strokeStyle = 'rgba(127,255,0,0.22)';
  ctx.beginPath();
  for (let a = Math.ceil(auL / labelStep) * labelStep; a <= auR; a += labelStep) {
    const x = toX(a); ctx.moveTo(x, lineTop); ctx.lineTo(x, lineBot);
  }
  for (let a = Math.ceil(auB / labelStep) * labelStep; a <= auT; a += labelStep) {
    const y = toY(a); ctx.moveTo(lineLeft, y); ctx.lineTo(lineRight, y);
  }
  ctx.stroke();

  // Axes through Sol
  ctx.strokeStyle = 'rgba(127,255,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (0 >= Math.min(auL, auR) && 0 <= Math.max(auL, auR)) { const x = toX(0); ctx.moveTo(x, lineTop); ctx.lineTo(x, lineBot); }
  if (0 >= Math.min(auB, auT) && 0 <= Math.max(auB, auT)) { const y = toY(0); ctx.moveTo(lineLeft, y); ctx.lineTo(lineRight, y); }
  ctx.stroke();

  // Boundary of the navigable field (±chartHalfAu)
  ctx.strokeStyle = 'rgba(127,255,0,0.35)';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  ctx.strokeRect(toX(-chartHalfAu), toY(chartHalfAu), 2 * chartHalfAu * pxPerAu, 2 * chartHalfAu * pxPerAu);
  ctx.setLineDash([]);

  // SOL at the origin (if visible)
  const sx = toX(0);
  const sy = toY(0);
  if (sx >= -20 && sx <= w + 20 && sy >= -20 && sy <= h + 20) drawSolMarker(ctx, sx, sy);
}

