//! Best-effort touch-device enumeration for the first-boot Touch Test screen.
//!
//! The actual multi-touch verification happens in the frontend via Pointer
//! events; this command just reports what libinput sees so the UI can tell the
//! user whether a touch device was detected at all.

use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct TouchDevice {
    pub name: String,
}

/// List detected touch-capable input devices (empty if none / no permission).
#[tauri::command]
pub fn touch_devices() -> Result<Vec<TouchDevice>, String> {
    let out = Command::new("libinput")
        .args(["list-devices"])
        .output()
        .map_err(|e| format!("libinput not available: {e}"))?;

    let text = String::from_utf8_lossy(&out.stdout);
    let mut devices = Vec::new();
    let mut current_name: Option<String> = None;

    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("Device:") {
            current_name = Some(rest.trim().to_string());
        } else if line.contains("Capabilities:") && line.contains("touch") {
            if let Some(name) = current_name.take() {
                devices.push(TouchDevice { name });
            }
        }
    }

    Ok(devices)
}
