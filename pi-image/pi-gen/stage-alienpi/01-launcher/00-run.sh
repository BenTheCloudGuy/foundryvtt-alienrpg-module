#!/bin/bash -e
# Install the AlienPi launcher .deb (built by the Tauri arm64 job and dropped
# into files/ before running pi-gen).

if ls files/*.deb >/dev/null 2>&1; then
	install -d "${ROOTFS_DIR}/tmp/alienpi"
	install -m 644 files/*.deb "${ROOTFS_DIR}/tmp/alienpi/"
	on_chroot <<'CHROOT'
set -e
apt-get install -y /tmp/alienpi/*.deb
rm -rf /tmp/alienpi
CHROOT
else
	echo "WARNING: no launcher .deb in stage-alienpi/01-launcher/files/."
	echo "         Build it first (see pi-image/launcher) and copy it here."
	exit 1
fi
