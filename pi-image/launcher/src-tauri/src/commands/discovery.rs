//! FoundryVTT game discovery.
//!
//! Three complementary strategies, merged and de-duplicated by `host:port`:
//!   1. mDNS  — `avahi-browse` for `_foundryvtt._tcp` (advertised by the
//!              AlienRPG Docker image). Richest data, named worlds.
//!   2. Scan  — async TCP sweep of the local /24 on port 30000.
//!   3. Probe — `GET /api/status` confirms any host is FoundryVTT and enriches
//!              the entry (world, system, active, users). Also used for manual
//!              entry.

use serde::Serialize;
use std::collections::BTreeMap;
use std::process::Command;
use std::time::Duration;

const FOUNDRY_DEFAULT_PORT: u16 = 30000;
const PROBE_TIMEOUT: Duration = Duration::from_secs(2);
const CONNECT_TIMEOUT: Duration = Duration::from_millis(400);

#[derive(Serialize, Clone)]
pub struct GameServer {
    pub host: String,
    pub port: u16,
    /// Display name — world title (mDNS) or world id (probe) or host.
    pub name: String,
    pub world: Option<String>,
    pub system: Option<String>,
    pub active: Option<bool>,
    pub users: Option<u32>,
    /// "mdns" | "scan" | "manual"
    pub source: String,
}

/// Discover every FoundryVTT server reachable on the LAN.
#[tauri::command]
pub async fn discover_games() -> Result<Vec<GameServer>, String> {
    let mdns_handle = tokio::task::spawn_blocking(avahi_browse);
    let scan = scan_subnet();
    let (mdns_res, scanned) = tokio::join!(mdns_handle, scan);

    let mut map: BTreeMap<String, GameServer> = BTreeMap::new();

    // Scan hits first (lowest priority).
    for g in scanned {
        map.insert(format!("{}:{}", g.host, g.port), g);
    }

    // mDNS entries override scan entries and get enriched via a live probe.
    if let Ok(list) = mdns_res {
        for mut g in list {
            if let Some(p) = probe(&g.host, g.port).await {
                g.world = g.world.or(p.world);
                g.system = g.system.or(p.system);
                g.active = p.active.or(g.active);
                g.users = p.users.or(g.users);
            }
            map.insert(format!("{}:{}", g.host, g.port), g);
        }
    }

    Ok(map.into_values().collect())
}

/// Probe a single host:port. Used for manual entry and to validate discovery.
#[tauri::command]
pub async fn probe_status(host: String, port: u16) -> Result<GameServer, String> {
    let port = if port == 0 { FOUNDRY_DEFAULT_PORT } else { port };
    probe(&host, port)
        .await
        .map(|mut g| {
            g.source = "manual".to_string();
            g
        })
        .ok_or_else(|| format!("No FoundryVTT server responded at {host}:{port}"))
}

/// `GET http://host:port/api/status` and map the JSON to a `GameServer`.
async fn probe(host: &str, port: u16) -> Option<GameServer> {
    let url = format!("http://{host}:{port}/api/status");
    let client = reqwest::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .build()
        .ok()?;
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let json: serde_json::Value = resp.json().await.ok()?;

    let world = json.get("world").and_then(|v| v.as_str()).map(String::from);
    let system = json
        .get("system")
        .and_then(|v| v.as_str())
        .map(String::from);
    let active = json.get("active").and_then(|v| v.as_bool());
    let users = json
        .get("users")
        .and_then(|v| v.as_u64())
        .map(|u| u as u32);

    let name = world.clone().unwrap_or_else(|| host.to_string());

    Some(GameServer {
        host: host.to_string(),
        port,
        name,
        world,
        system,
        active,
        users,
        source: "scan".to_string(),
    })
}

/// Determine the local IPv4 /24 base (e.g. "192.168.1") via `ip`.
fn local_ipv4_24() -> Option<String> {
    let out = Command::new("ip")
        .args(["-o", "-4", "addr", "show", "scope", "global"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        if let Some(idx) = line.find("inet ") {
            let rest = &line[idx + 5..];
            let cidr = rest.split_whitespace().next()?;
            let ip = cidr.split('/').next()?;
            let octets: Vec<&str> = ip.split('.').collect();
            if octets.len() == 4 {
                return Some(format!("{}.{}.{}", octets[0], octets[1], octets[2]));
            }
        }
    }
    None
}

/// TCP-connect sweep of the local /24 on the Foundry port, probing every hit.
async fn scan_subnet() -> Vec<GameServer> {
    let base = match local_ipv4_24() {
        Some(b) => b,
        None => return Vec::new(),
    };

    let mut handles = Vec::new();
    for i in 1..=254u8 {
        let ip = format!("{base}.{i}");
        handles.push(tokio::spawn(async move {
            let addr = format!("{ip}:{FOUNDRY_DEFAULT_PORT}");
            let sock: std::net::SocketAddr = addr.parse().ok()?;
            match tokio::time::timeout(
                CONNECT_TIMEOUT,
                tokio::net::TcpStream::connect(sock),
            )
            .await
            {
                Ok(Ok(_)) => probe(&ip, FOUNDRY_DEFAULT_PORT).await,
                _ => None,
            }
        }));
    }

    let mut found = Vec::new();
    for h in handles {
        if let Ok(Some(g)) = h.await {
            found.push(g);
        }
    }
    found
}

/// Parse `avahi-browse -r -t -p` resolved (`=`) lines into servers.
fn avahi_browse() -> Vec<GameServer> {
    let out = match Command::new("avahi-browse")
        .args(["-r", "-t", "-p", "_foundryvtt._tcp"])
        .output()
    {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };

    let text = String::from_utf8_lossy(&out.stdout);
    let mut servers = Vec::new();

    for line in text.lines() {
        // Resolved records begin with '='.
        // =;iface;proto;name;type;domain;host;addr;port;"k=v" "k=v" ...
        if !line.starts_with('=') {
            continue;
        }
        let parts: Vec<&str> = line.split(';').collect();
        if parts.len() < 9 {
            continue;
        }

        let instance = unescape_avahi(parts[3]);
        let addr = parts[7].to_string();
        let port = parts[8].parse::<u16>().unwrap_or(FOUNDRY_DEFAULT_PORT);
        let txt = parts.get(9).copied().unwrap_or("");

        let (world, world_title, system, active, users) = parse_txt(txt);
        let name = world_title
            .clone()
            .filter(|s| !s.is_empty())
            .or_else(|| {
                if instance.is_empty() {
                    None
                } else {
                    Some(instance.clone())
                }
            })
            .or_else(|| world.clone())
            .unwrap_or_else(|| addr.clone());

        servers.push(GameServer {
            host: addr,
            port,
            name,
            world,
            system,
            active,
            users,
            source: "mdns".to_string(),
        });
    }

    servers
}

/// avahi escapes some chars as `\NNN` (decimal) or `\\`/`\.`; decode common cases.
fn unescape_avahi(s: &str) -> String {
    let mut out = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            // Try three-digit decimal escape (e.g. \032 = space).
            let digits: String = chars.clone().take(3).collect();
            if digits.len() == 3 && digits.chars().all(|d| d.is_ascii_digit()) {
                if let Ok(code) = digits.parse::<u32>() {
                    if let Some(ch) = char::from_u32(code) {
                        out.push(ch);
                        for _ in 0..3 {
                            chars.next();
                        }
                        continue;
                    }
                }
            }
            if let Some(next) = chars.next() {
                out.push(next);
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Parse the TXT field (space-separated `"key=value"` tokens) from avahi.
fn parse_txt(
    txt: &str,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<bool>,
    Option<u32>,
) {
    let mut world = None;
    let mut world_title = None;
    let mut system = None;
    let mut active = None;
    let mut users = None;

    for token in split_quoted(txt) {
        let (k, v) = match token.split_once('=') {
            Some(kv) => kv,
            None => continue,
        };
        match k {
            "world" => world = Some(v.to_string()),
            "worldTitle" => world_title = Some(v.to_string()),
            "system" => system = Some(v.to_string()),
            "active" => active = Some(v == "1" || v.eq_ignore_ascii_case("true")),
            "users" => users = v.parse::<u32>().ok(),
            _ => {}
        }
    }

    (world, world_title, system, active, users)
}

/// Split a string on spaces, honouring `"double quoted"` segments.
fn split_quoted(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_quotes = false;
    for c in s.chars() {
        match c {
            '"' => in_quotes = !in_quotes,
            ' ' if !in_quotes => {
                if !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                }
            }
            _ => cur.push(c),
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}
