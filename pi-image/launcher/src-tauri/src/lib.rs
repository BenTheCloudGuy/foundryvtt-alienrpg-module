mod commands;

/// Entry point for the AlienPi MU/TH/UR launcher.
///
/// The launcher is the permanent shell on the device. FoundryVTT opens in a
/// Chromium kiosk *over* this window; returning to the launcher is done by
/// rebooting (see `commands::launch::restart_terminal`).
pub fn run() {
    // WebKitGTK on some Pi / Wayland setups needs compositing disabled for
    // stability. Only set it if the operator hasn't overridden it.
    if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::wifi::wifi_scan,
            commands::wifi::wifi_connect,
            commands::wifi::wifi_status,
            commands::discovery::discover_games,
            commands::discovery::probe_status,
            commands::launch::launch_game,
            commands::launch::restart_terminal,
            commands::touch::touch_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the AlienPi launcher");
}
