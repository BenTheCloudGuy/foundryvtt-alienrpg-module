#!/bin/bash -e
# Configure the MU/TH/UR kiosk: kiosk user, systemd service, labwc autostart,
# polkit (NetworkManager for the kiosk user), and Pi 5 / 1080p boot settings.

# --- systemd kiosk service --------------------------------------------------
install -d "${ROOTFS_DIR}/etc/systemd/system"
install -m 644 files/alienpi-kiosk.service \
	"${ROOTFS_DIR}/etc/systemd/system/alienpi-kiosk.service"

# --- polkit: let the kiosk user manage NetworkManager -----------------------
install -d "${ROOTFS_DIR}/etc/polkit-1/rules.d"
install -m 644 files/50-alienpi.rules \
	"${ROOTFS_DIR}/etc/polkit-1/rules.d/50-alienpi.rules"

# --- labwc session for the kiosk user ---------------------------------------
install -d "${ROOTFS_DIR}/home/alienpi/.config/labwc"
install -m 755 files/labwc-autostart \
	"${ROOTFS_DIR}/home/alienpi/.config/labwc/autostart"
install -m 644 files/labwc-rc.xml \
	"${ROOTFS_DIR}/home/alienpi/.config/labwc/rc.xml"
install -m 644 files/labwc-environment \
	"${ROOTFS_DIR}/home/alienpi/.config/labwc/environment"

# --- Pi 5 / 1080p boot config -----------------------------------------------
BOOT_CFG="${ROOTFS_DIR}/boot/firmware/config.txt"
[ -f "${BOOT_CFG}" ] || BOOT_CFG="${ROOTFS_DIR}/boot/config.txt"
cat files/config-append.txt >> "${BOOT_CFG}"

# Quiet boot, no console blanking, no text cursor.
CMDLINE="${ROOTFS_DIR}/boot/firmware/cmdline.txt"
[ -f "${CMDLINE}" ] || CMDLINE="${ROOTFS_DIR}/boot/cmdline.txt"
if ! grep -q "logo.nologo" "${CMDLINE}"; then
	sed -i 's/[[:space:]]*$/ logo.nologo consoleblank=0 vt.global_cursor_default=0 quiet/' "${CMDLINE}"
fi

on_chroot <<'CHROOT'
set -e

# Dedicated kiosk user (pi-gen's FIRST_USER_NAME=alienpi may already exist).
if ! id alienpi >/dev/null 2>&1; then
	useradd -m -s /bin/bash alienpi
fi
# Groups needed for Wayland/DRM/input/network on a seatless kiosk.
usermod -aG video,render,input,audio,netdev,plugdev,tty,seat alienpi 2>/dev/null || \
	usermod -aG video,render,input,audio,netdev,plugdev,tty alienpi

chown -R alienpi:alienpi /home/alienpi/.config

# Enable services.
systemctl enable seatd.service            || true
systemctl enable NetworkManager.service   || true
systemctl enable avahi-daemon.service     || true
systemctl enable alienpi-kiosk.service    || true

# Headless multi-user target; the kiosk service owns tty1.
systemctl set-default multi-user.target   || true
CHROOT
