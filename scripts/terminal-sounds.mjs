/**
 * TerminalSFX — Sound effects manager for the WY Terminal.
 * ALL sounds are player-only. GM clients produce ZERO audio.
 *
 * Usage:
 *   import { TerminalSFX } from './terminal-sounds.mjs';
 *   TerminalSFX.play('beep');
 */

const SOUND_BASE = 'modules/wy-terminal/muthur/sounds';

/** Sound map — logical name → file + default volume */
const SOUNDS = {
  beep:           { file: 'beep.wav',             volume: 0.4  },
  boot:           { file: 'boot.wav',             volume: 0.5  },
  screenChange:   { file: 'screen_display.wav',   volume: 0.35 },
  typeSend:       { file: 'loud_type_start.wav',  volume: 0.3  },
  typeResponse:   { file: 'subtle_long_type.wav', volume: 0.3  },
  printer:        { file: 'printer2.wav',         volume: 0.3  },
  alert:          { file: 'horn.wav',             volume: 0.5  },
  emergency:      { file: 'horn.wav',             volume: 0.7  },
  buzz:           { file: 'buzz.wav',             volume: 0.4  },
  rattle:         { file: 'rattle.wav',           volume: 0.3  },
  downshuffle:    { file: 'downshuffle.wav',      volume: 0.35 },
};

/** Cache of HTMLAudioElement instances for instant replay */
const _cache = {};

export class TerminalSFX {

  /**
   * Play a named sound effect.  Does nothing if:
   *  - The current user is the GM
   *  - Sound is disabled in settings
   *  - The sound name is unknown
   *
   * @param {string} name   Key from SOUNDS map
   * @param {object} [opts]
   * @param {number} [opts.volume]  Override default volume (0–1)
   * @param {boolean} [opts.force]  Force play even if setting is off (never for GM)
   */
  static play(name, opts = {}) {
    // ── HARD BLOCK: GM clients produce zero sound ──
    if (game.user?.isGM) return;

    // ── Check user preference ──
    if (!opts.force) {
      try {
        if (!game.settings.get('wy-terminal', 'soundEnabled')) return;
      } catch { /* if setting missing, default to enabled */ }
    }

    const entry = SOUNDS[name];
    if (!entry) {
      console.warn(`TerminalSFX | Unknown sound: "${name}"`);
      return;
    }

    const src = `${SOUND_BASE}/${entry.file}`;
    const vol = Math.min(1, Math.max(0, opts.volume ?? entry.volume));

    // Use Foundry's AudioHelper if available, otherwise raw HTMLAudio
    try {
      if (typeof AudioHelper !== 'undefined' && AudioHelper.play) {
        AudioHelper.play({ src, volume: vol, autoplay: true, loop: false }, false);
      } else {
        this._playRaw(src, vol);
      }
    } catch (err) {
      console.warn('TerminalSFX | Playback failed:', err);
    }
  }

  /**
   * Fallback: play via native HTMLAudioElement.
   */
  static _playRaw(src, volume) {
    let audio = _cache[src];
    if (!audio) {
      audio = new Audio(src);
      _cache[src] = audio;
    }
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  /**
   * Preload all sounds into browser cache (call once on ready).
   * Only preloads for non-GM users.
   */
  static preload() {
    if (game.user?.isGM) return;
    for (const entry of Object.values(SOUNDS)) {
      const src = `${SOUND_BASE}/${entry.file}`;
      if (!_cache[src]) {
        const a = new Audio();
        a.preload = 'auto';
        a.src = src;
        _cache[src] = a;
      }
    }
  }
}
