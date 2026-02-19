/**
 * PinchZoomHandler — Touch-friendly zoom and pan for the terminal display frame.
 * Supports pinch-to-zoom, scroll-wheel zoom, and drag-to-pan.
 * The display frame scrolls and zooms independently of the navigation buttons.
 */

export class PinchZoomHandler {

  /** @type {HTMLElement} The scrollable container */
  container;

  /** @type {HTMLElement} The content element that gets transformed */
  content;

  /** Current zoom scale */
  scale = 1;

  /** Minimum zoom */
  minScale = 0.25;

  /** Maximum zoom */
  maxScale = 5;

  /** Zoom step for buttons/wheel */
  zoomStep = 0.15;

  /** Pan offset */
  panX = 0;
  panY = 0;

  /** Whether zoom/pan interactions are enabled */
  enabled = true;

  /** Tracking for touch gestures */
  _touches = [];
  _lastDist = 0;
  _lastCenter = null;
  _isPanning = false;
  _panStart = null;

  /** Bound event handlers (for cleanup) */
  _handlers = {};

  /** @type {ResizeObserver|null} */
  _resizeObserver = null;

  constructor(container, content) {
    this.container = container;
    this.content = content;

    this._bind();

    // Re-clamp on viewport resize so the image is never clipped
    this._resizeObserver = new ResizeObserver(() => {
      this._clampPan();
      this._applyTransform();
    });
    this._resizeObserver.observe(this.container);
  }

  /* ──────────────────────────────────────────────────────────────────
     SETUP & TEARDOWN
     ────────────────────────────────────────────────────────────────── */

  _bind() {
    const h = this._handlers;

    // Mouse wheel zoom
    h.wheel = (e) => this._onWheel(e);
    this.container.addEventListener('wheel', h.wheel, { passive: false });

    // Touch events for pinch-zoom and pan
    h.touchstart = (e) => this._onTouchStart(e);
    h.touchmove = (e) => this._onTouchMove(e);
    h.touchend = (e) => this._onTouchEnd(e);
    this.container.addEventListener('touchstart', h.touchstart, { passive: false });
    this.container.addEventListener('touchmove', h.touchmove, { passive: false });
    this.container.addEventListener('touchend', h.touchend);
    this.container.addEventListener('touchcancel', h.touchend);

    // Mouse drag-to-pan (for desktop)
    h.mousedown = (e) => this._onMouseDown(e);
    h.mousemove = (e) => this._onMouseMove(e);
    h.mouseup = (e) => this._onMouseUp(e);
    this.container.addEventListener('mousedown', h.mousedown);
    window.addEventListener('mousemove', h.mousemove);
    window.addEventListener('mouseup', h.mouseup);

    // Prevent context menu on long-press
    h.contextmenu = (e) => {
      if (this._isPanning) e.preventDefault();
    };
    this.container.addEventListener('contextmenu', h.contextmenu);
  }

  destroy() {
    const h = this._handlers;
    this.container.removeEventListener('wheel', h.wheel);
    this.container.removeEventListener('touchstart', h.touchstart);
    this.container.removeEventListener('touchmove', h.touchmove);
    this.container.removeEventListener('touchend', h.touchend);
    this.container.removeEventListener('touchcancel', h.touchend);
    this.container.removeEventListener('mousedown', h.mousedown);
    window.removeEventListener('mousemove', h.mousemove);
    window.removeEventListener('mouseup', h.mouseup);
    this.container.removeEventListener('contextmenu', h.contextmenu);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  /* ──────────────────────────────────────────────────────────────────
     PUBLIC API
     ────────────────────────────────────────────────────────────────── */

  zoomIn() {
    if (!this.enabled) return;
    this._setScale(this.scale + this.zoomStep);
  }

  zoomOut() {
    if (!this.enabled) return;
    this._setScale(this.scale - this.zoomStep);
  }

  reset() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this._applyTransform();
  }

  /* ──────────────────────────────────────────────────────────────────
     MOUSE WHEEL ZOOM
     ────────────────────────────────────────────────────────────────── */

  _onWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;

    // Zoom towards cursor position
    const rect = this.container.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const oldScale = this.scale;
    this._setScale(this.scale + delta, false);

    // Adjust pan so the zoom centers on cursor
    const ratio = this.scale / oldScale;
    this.panX = cx - ratio * (cx - this.panX);
    this.panY = cy - ratio * (cy - this.panY);

    this._applyTransform();
  }

  /* ──────────────────────────────────────────────────────────────────
     TOUCH: PINCH ZOOM + PAN
     ────────────────────────────────────────────────────────────────── */

  _onTouchStart(e) {
    if (!this.enabled) return;
    this._touches = Array.from(e.touches);

    if (this._touches.length === 2) {
      e.preventDefault();
      this._lastDist = this._getTouchDistance(this._touches);
      this._lastCenter = this._getTouchCenter(this._touches);
    } else if (this._touches.length === 1 && this.scale > 1) {
      // Single finger pan when zoomed
      this._isPanning = true;
      this._panStart = {
        x: this._touches[0].clientX - this.panX,
        y: this._touches[0].clientY - this.panY,
      };
    }
  }

  _onTouchMove(e) {
    const currentTouches = Array.from(e.touches);

    if (currentTouches.length === 2) {
      e.preventDefault();
      const dist = this._getTouchDistance(currentTouches);
      const center = this._getTouchCenter(currentTouches);

      if (this._lastDist > 0) {
        const scaleDelta = dist / this._lastDist;
        const oldScale = this.scale;
        this._setScale(this.scale * scaleDelta, false);

        // Adjust pan for zoom center
        const rect = this.container.getBoundingClientRect();
        const cx = center.x - rect.left;
        const cy = center.y - rect.top;
        const ratio = this.scale / oldScale;
        this.panX = cx - ratio * (cx - this.panX);
        this.panY = cy - ratio * (cy - this.panY);
      }

      // Pan with two fingers
      if (this._lastCenter) {
        this.panX += center.x - this._lastCenter.x;
        this.panY += center.y - this._lastCenter.y;
      }

      this._lastDist = dist;
      this._lastCenter = center;
      this._applyTransform();

    } else if (currentTouches.length === 1 && this._isPanning) {
      e.preventDefault();
      this.panX = currentTouches[0].clientX - this._panStart.x;
      this.panY = currentTouches[0].clientY - this._panStart.y;
      this._applyTransform();
    }
  }

  _onTouchEnd(e) {
    const remaining = e.touches?.length ?? 0;
    if (remaining < 2) {
      this._lastDist = 0;
      this._lastCenter = null;
    }
    if (remaining === 0) {
      this._isPanning = false;
      this._panStart = null;
    }
  }

  /* ──────────────────────────────────────────────────────────────────
     MOUSE DRAG PAN
     ────────────────────────────────────────────────────────────────── */

  _onMouseDown(e) {
    if (!this.enabled) return;
    if (e.button !== 0) return; // Left click only
    if (this.scale <= 1) return; // Only pan when zoomed

    this._isPanning = true;
    this._panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
    this.container.style.cursor = 'grabbing';
    e.preventDefault();
  }

  _onMouseMove(e) {
    if (!this._isPanning || !this._panStart) return;
    this.panX = e.clientX - this._panStart.x;
    this.panY = e.clientY - this._panStart.y;
    this._applyTransform();
  }

  _onMouseUp() {
    this._isPanning = false;
    this._panStart = null;
    this.container.style.cursor = '';
  }

  /* ──────────────────────────────────────────────────────────────────
     INTERNAL
     ────────────────────────────────────────────────────────────────── */

  _setScale(newScale, apply = true) {
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    if (this.scale <= 1) {
      this.panX = 0;
      this.panY = 0;
    }
    if (apply) this._applyTransform();
  }

  /**
   * Clamp panX/panY so the scaled content never leaves the viewport edges.
   * At scale <= 1 the content fits entirely, so pan is zeroed.
   * Uses actual content dimensions (not container) for correct aspect-ratio handling.
   */
  _clampPan() {
    if (this.scale <= 1) {
      this.panX = 0;
      this.panY = 0;
      return;
    }
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    // Use content element's natural rendered size (before transform)
    const contentW = this.content.offsetWidth || cw;
    const contentH = this.content.offsetHeight || ch;
    const sw = contentW * this.scale;
    const sh = contentH * this.scale;

    // Negative pan = content shifted left/up, clamped so right/bottom edge stays in view
    const minX = cw - sw;
    const minY = ch - sh;
    this.panX = Math.min(0, Math.max(minX, this.panX));
    this.panY = Math.min(0, Math.max(minY, this.panY));
  }

  _applyTransform() {
    this._clampPan();
    this.content.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    this.content.style.transition = 'none'; // Disable transition during interaction
  }

  _getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _getTouchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }
}
