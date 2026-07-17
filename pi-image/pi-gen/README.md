# AlienPi — pi-gen custom stage

Builds the flashable **AlienPi** `.img`: Raspberry Pi OS Lite 64-bit (Trixie)
that boots straight into the MU/TH/UR launcher kiosk (labwc + the Tauri
launcher `.deb`), with NetworkManager, Avahi, Chromium, and squeekboard.

## Prerequisites

- A Linux build host (native **arm64** recommended — see the CI workflow).
- [`pi-gen`](https://github.com/RPi-Distro/pi-gen) checked out **from the
  `arm64` branch** (64-bit, Trixie): `git clone --branch arm64 https://github.com/RPi-Distro/pi-gen`.
- The launcher `.deb` built and copied into
  `stage-alienpi/01-launcher/files/` (see `pi-image/launcher`).

## Wiring the stage into pi-gen

1. Copy (or symlink) `stage-alienpi/` into your pi-gen checkout root.
2. Use `config.example` as your pi-gen `config` (edit as needed). Key bits:
   - `STAGE_LIST="stage0 stage1 stage2 ./stage-alienpi"` (Lite base = through
     stage2; no desktop).
   - `FIRST_USER_NAME='alienpi'` so the kiosk user owns the session.
3. Build:

   ```bash
   sudo ./build.sh            # or ./build-docker.sh
   ```

The image is exported by the `EXPORT_IMAGE` marker in `stage-alienpi`.

## What the stage does

| Sub-stage | Action |
|-----------|--------|
| `00-install-packages` | Installs labwc, Chromium, NetworkManager, Avahi, squeekboard, WebKitGTK, fonts, polkit, dbus, seatd. |
| `01-launcher` | Installs the AlienPi launcher `.deb` from `files/`. |
| `02-kiosk` | Creates the `alienpi` kiosk user, installs the systemd kiosk service + labwc autostart, polkit rules (NetworkManager for the kiosk user), and appends Pi 5 / 1080p settings to `config.txt` + `cmdline.txt`. |

## Boot behaviour

- `systemctl` default target is `multi-user` (no display manager).
- `alienpi-kiosk.service` opens a login session on `tty1` and runs `labwc`.
- labwc `autostart` starts `squeekboard` and execs `/usr/bin/alienpi-launcher`.
- The launcher plays `boot.wav` + the MU/TH/UR boot log, then shows the menu.
- Reboot-to-return: the launcher's **RESTART TERMINAL** calls `systemctl reboot`
  (permitted for the active local session), cleanly ending any Foundry kiosk.
