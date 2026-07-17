//! WiFi management via NetworkManager's `nmcli`.
//!
//! Credentials persist across reboots automatically (NetworkManager stores the
//! connection profile), so the reboot-to-return flow never re-onboards WiFi.

use serde::Serialize;
use std::collections::HashSet;
use std::process::Command;

#[derive(Serialize)]
pub struct WifiNetwork {
    pub ssid: String,
    pub signal: u8,
    pub security: String,
    pub in_use: bool,
}

/// Split an `nmcli -t` (terse) line on unescaped `:` separators.
///
/// nmcli escapes literal colons inside field values as `\:`, so a naive
/// `split(':')` corrupts SSIDs/security strings that contain colons.
fn split_nmcli(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut cur = String::new();
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                if let Some(&next) = chars.peek() {
                    cur.push(next);
                    chars.next();
                } else {
                    cur.push('\\');
                }
            }
            ':' => {
                fields.push(std::mem::take(&mut cur));
            }
            _ => cur.push(c),
        }
    }
    fields.push(cur);
    fields
}

/// Scan for nearby WiFi networks (strongest first, de-duplicated by SSID).
#[tauri::command]
pub async fn wifi_scan() -> Result<Vec<WifiNetwork>, String> {
    // Best-effort rescan; ignore errors (a scan may already be in progress).
    let _ = Command::new("nmcli").args(["dev", "wifi", "rescan"]).output();

    let out = Command::new("nmcli")
        .args([
            "-t",
            "-f",
            "IN-USE,SSID,SIGNAL,SECURITY",
            "dev",
            "wifi",
            "list",
        ])
        .output()
        .map_err(|e| format!("nmcli not available: {e}"))?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }

    let text = String::from_utf8_lossy(&out.stdout);
    let mut nets = Vec::new();
    let mut seen = HashSet::new();

    for line in text.lines() {
        let fields = split_nmcli(line);
        if fields.len() < 4 {
            continue;
        }
        let in_use = fields[0].trim() == "*";
        let ssid = fields[1].trim().to_string();
        if ssid.is_empty() {
            continue;
        }
        if !seen.insert(ssid.clone()) {
            continue;
        }
        let signal = fields[2].trim().parse::<u8>().unwrap_or(0);
        let security = {
            let s = fields[3].trim();
            if s.is_empty() {
                "OPEN".to_string()
            } else {
                s.to_string()
            }
        };
        nets.push(WifiNetwork {
            ssid,
            signal,
            security,
            in_use,
        });
    }

    nets.sort_by(|a, b| b.signal.cmp(&a.signal));
    Ok(nets)
}

/// Connect to a network. `password` may be empty/None for open networks.
#[tauri::command]
pub async fn wifi_connect(ssid: String, password: Option<String>) -> Result<String, String> {
    if ssid.trim().is_empty() {
        return Err("No network selected.".to_string());
    }

    let mut args: Vec<String> = vec![
        "dev".into(),
        "wifi".into(),
        "connect".into(),
        ssid.clone(),
    ];
    if let Some(pw) = password.as_ref().filter(|p| !p.is_empty()) {
        args.push("password".into());
        args.push(pw.clone());
    }

    let out = Command::new("nmcli")
        .args(&args)
        .output()
        .map_err(|e| format!("nmcli not available: {e}"))?;

    if out.status.success() {
        Ok(format!("Connected to {ssid}"))
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// Return the SSID of the currently active connection, if any.
#[tauri::command]
pub async fn wifi_status() -> Result<Option<String>, String> {
    let out = Command::new("nmcli")
        .args(["-t", "-f", "ACTIVE,SSID", "dev", "wifi"])
        .output()
        .map_err(|e| format!("nmcli not available: {e}"))?;

    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        let f = split_nmcli(line);
        if f.len() >= 2 && f[0] == "yes" {
            return Ok(Some(f[1].clone()));
        }
    }
    Ok(None)
}
