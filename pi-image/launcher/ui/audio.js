/**
 * TerminalSFX — MU/TH/UR sound manager for the AlienPi launcher.
 *
 * Ported from the wy-terminal module's terminal-sounds.mjs, minus the Foundry
 * game/GM checks. WAV files are bundled into `ui/sounds/` at packaging time
 * from the module's `muthur/sounds/` directory.
 */
(function () {
  const SOUND_BASE = 'sounds';

  const SOUNDS = {
    beep: { file: 'beep.wav', volume: 0.4 },
    boot: { file: 'boot.wav', volume: 0.5 },
    screenChange: { file: 'screen_display.wav', volume: 0.35 },
    typeSend: { file: 'loud_type_start.wav', volume: 0.3 },
    key: { file: 'subtle_long_type.wav', volume: 0.25 },
    printer: { file: 'printer2.wav', volume: 0.3 },
    alert: { file: 'horn.wav', volume: 0.5 },
    buzz: { file: 'buzz.wav', volume: 0.4 },
    rattle: { file: 'rattle.wav', volume: 0.3 },
    downshuffle: { file: 'downshuffle.wav', volume: 0.35 },
  };

  const cache = {};

  const SFX = {
    play(name, opts = {}) {
      const entry = SOUNDS[name];
      if (!entry) {
        console.warn(`SFX | Unknown sound: "${name}"`);
        return;
      }
      const src = `${SOUND_BASE}/${entry.file}`;
      const vol = Math.min(1, Math.max(0, opts.volume ?? entry.volume));
      let audio = cache[src];
      if (!audio) {
        audio = new Audio(src);
        cache[src] = audio;
      }
      // Clone for overlapping playback so rapid key-clicks don't cut off.
      const node = opts.overlap === false ? audio : audio.cloneNode();
      node.volume = vol;
      node.currentTime = 0;
      node.play().catch(() => {});
    },

    preload() {
      for (const entry of Object.values(SOUNDS)) {
        const src = `${SOUND_BASE}/${entry.file}`;
        if (!cache[src]) {
          const a = new Audio();
          a.preload = 'auto';
          a.src = src;
          cache[src] = a;
        }
      }
    },
  };

  window.SFX = SFX;
})();
