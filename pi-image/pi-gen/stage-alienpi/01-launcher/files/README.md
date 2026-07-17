# Launcher .deb drop point

Copy the AlienPi launcher Debian package here before running pi-gen:

```bash
cp pi-image/launcher/src-tauri/target/release/bundle/deb/*.deb \
   pi-image/pi-gen/stage-alienpi/01-launcher/files/
```

`01-launcher/00-run.sh` installs every `*.deb` in this directory into the image.
The package is produced by the arm64 Tauri build (see the CI workflow); it is
not committed.
