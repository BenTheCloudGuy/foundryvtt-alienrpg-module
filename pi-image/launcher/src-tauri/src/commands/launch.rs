//! Launch the FoundryVTT kiosk and the reboot-to-return flow.

use std::process::Command;

/// Chromium candidates in preference order (package name varies by distro).
const CHROMIUM_BINS: &[&str] = &["chromium", "chromium-browser"];

/// Flags for a locked-down, touch-friendly, full-screen kiosk.
/// Pinch-zoom is intentionally left enabled for Foundry scene navigation.
const KIOSK_FLAGS: &[&str] = &[
    "--kiosk",
    "--ozone-platform=wayland",
    "--enable-features=UseOzonePlatform,OverlayScrollbar",
    "--touch-events=enabled",
    "--start-fullscreen",
    "--noerrdialogs",
    "--disable-infobars",
    "--disable-session-crashed-bubble",
    "--overscroll-history-navigation=0",
    "--check-for-update-interval=31536000",
    "--no-first-run",
    "--fast",
    "--fast-start",
];

/// Launch FoundryVTT in a Chromium kiosk over the launcher.
///
/// The launcher stays resident underneath; returning is done by rebooting
/// (see [`restart_terminal`]).
#[tauri::command]
pub fn launch_game(host: String, port: u16) -> Result<(), String> {
    if host.trim().is_empty() {
        return Err("No host provided.".to_string());
    }
    let port = if port == 0 { 30000 } else { port };
    let url = format!("http://{host}:{port}/join");

    for bin in CHROMIUM_BINS {
        let mut cmd = Command::new(bin);
        cmd.args(KIOSK_FLAGS).arg(&url);
        match cmd.spawn() {
            Ok(_) => return Ok(()),
            Err(_) => continue,
        }
    }

    Err("Chromium is not installed or could not be launched.".to_string())
}

/// Reboot-to-return: cleanly end any Foundry session and boot back into the
/// launcher (with the MU/TH/UR boot sequence).
#[tauri::command]
pub fn restart_terminal() -> Result<(), String> {
    // Prefer systemd; fall back to the classic reboot binary.
    if let Ok(status) = Command::new("systemctl").arg("reboot").status() {
        if status.success() {
            return Ok(());
        }
    }
    Command::new("reboot")
        .status()
        .map(|_| ())
        .map_err(|e| format!("Failed to reboot: {e}"))
}
