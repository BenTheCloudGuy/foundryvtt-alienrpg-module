# AlienPi Launcher (Tauri)

The MU/TH/UR 9000 kiosk launcher — the permanent shell on the AlienPi image. It
connects WiFi, discovers FoundryVTT games on the LAN, and launches them in a
full-screen Chromium kiosk. Returning to the launcher is done by rebooting
(reboot-to-return); there is no exit-to-desktop.

## Layout

```
launcher/
  src-tauri/            # Rust backend (Tauri v2)
    src/
      main.rs           # binary entry
      lib.rs            # builder + command registration
      commands/
        wifi.rs         # nmcli scan/connect/status
        discovery.rs    # avahi mDNS + /24 port scan + /api/status probe
        launch.rs       # Chromium kiosk + reboot-to-return
        touch.rs        # libinput touch-device enumeration
    tauri.conf.json
    Cargo.toml
    capabilities/default.json
    icons/              # app icons (generate with `cargo tauri icon`)
  ui/                   # frontend (no bundler; withGlobalTauri)
    index.html
    theme.css           # MU/TH/UR CRT theme (mirrors module terminal.css)
    app.js              # controller
    osk.js              # themed on-screen keyboard
    audio.js            # SFX manager (ported from terminal-sounds.mjs)
    sounds/             # WAVs copied from ../../../muthur/sounds at build time
```

## Prerequisites

- Rust (stable) + `cargo`
- Tauri v2 system deps: `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`,
  `libayatana-appindicator3-dev`, `librsvg2-dev`
- Tauri CLI: `cargo install tauri-cli --version "^2"`

## Build

The launcher bundles the MU/TH/UR sound effects, so copy them in first:

```bash
# from repo root
mkdir -p pi-image/launcher/ui/sounds
cp muthur/sounds/*.wav pi-image/launcher/ui/sounds/

# generate icons once (any square PNG works as the source)
cd pi-image/launcher
cargo tauri icon ../../images/icon.png   # adjust source path

# build the arm64 .deb (run on arm64 — see the CI workflow)
cargo tauri build --bundles deb
```

The `.deb` lands in `src-tauri/target/release/bundle/deb/`. The pi-gen stage
installs it from `pi-image/pi-gen/stage-alienpi/01-launcher/files/`.

## Notes

- `withGlobalTauri: true` lets the no-bundler frontend call
  `window.__TAURI__.core.invoke` directly.
- The window is fullscreen + undecorated (kiosk). WebKitGTK compositing is
  disabled at startup for Pi/Wayland stability.
- Foundry itself renders in **Chromium** (spawned by `launch_game`), not the
  Tauri WebKit webview.
