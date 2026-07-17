# App icons

Tauri bundling expects icons here. Generate them once from any square PNG:

```bash
cd pi-image/launcher
cargo tauri icon path/to/source.png
```

This produces `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`
(and platform icons) referenced by `tauri.conf.json`. They are not committed;
the CI workflow generates them before building.
