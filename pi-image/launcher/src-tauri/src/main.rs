// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), cfg_attr(windows, windows_subsystem = "windows"))]

fn main() {
    alienpi_launcher_lib::run();
}
