# Launcher sound effects

This directory is populated at build time with the MU/TH/UR WAV files from the
module's `muthur/sounds/` directory:

```bash
cp muthur/sounds/*.wav pi-image/launcher/ui/sounds/
```

`audio.js` references these by filename (e.g. `sounds/boot.wav`). They are not
committed here to avoid duplicating the assets; the CI workflow copies them
before `cargo tauri build`.
