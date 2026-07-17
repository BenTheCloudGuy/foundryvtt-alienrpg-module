#!/bin/sh
# advertise.sh — publish the running FoundryVTT server over mDNS.
#
# Polls Foundry's /api/status and writes an Avahi service file describing the
# active world. Avahi auto-reloads service files on change, so updates (world
# switch, user count, going inactive) are reflected on the LAN within one
# refresh interval. Consumed by the AlienPi launcher via `avahi-browse`.
set -eu

STATUS_URL="${FOUNDRY_STATUS_URL:-http://127.0.0.1:30000/api/status}"
PORT="${FOUNDRY_ADVERTISE_PORT:-30000}"
WORLD_TITLE_ENV="${FOUNDRY_WORLD_TITLE:-}"
REFRESH="${MDNS_REFRESH_SECONDS:-30}"

SERVICE_DIR="/etc/avahi/services"
SERVICE_FILE="${SERVICE_DIR}/foundryvtt.service"

mkdir -p /run/dbus "${SERVICE_DIR}"

# dbus + avahi need a machine-id.
dbus-uuidgen --ensure=/etc/machine-id 2>/dev/null || true

# Start the system bus and Avahi (host networking → mDNS reaches the LAN).
dbus-daemon --system --fork 2>/dev/null || true
avahi-daemon --daemonize --no-drop-root 2>/dev/null \
  || avahi-daemon --daemonize 2>/dev/null || true

# XML-escape a value for inclusion in the service file.
esc() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

write_service() {
  world="$1"; title="$2"; system="$3"; sysver="$4"; core="$5"; active="$6"; users="$7"
  tmp="${SERVICE_FILE}.tmp"
  {
    echo '<?xml version="1.0" standalone="no"?>'
    echo '<!DOCTYPE service-group SYSTEM "avahi-service.dtd">'
    echo '<service-group>'
    printf '  <name>%s</name>\n' "$(esc "${title:-FoundryVTT}")"
    echo '  <service>'
    echo '    <type>_foundryvtt._tcp</type>'
    printf '    <port>%s</port>\n' "$PORT"
    [ -n "$world" ]  && printf '    <txt-record>world=%s</txt-record>\n' "$(esc "$world")"
    [ -n "$title" ]  && printf '    <txt-record>worldTitle=%s</txt-record>\n' "$(esc "$title")"
    [ -n "$system" ] && printf '    <txt-record>system=%s</txt-record>\n' "$(esc "$system")"
    [ -n "$sysver" ] && printf '    <txt-record>systemVersion=%s</txt-record>\n' "$(esc "$sysver")"
    [ -n "$core" ]   && printf '    <txt-record>coreVersion=%s</txt-record>\n' "$(esc "$core")"
    printf '    <txt-record>active=%s</txt-record>\n' "${active:-0}"
    [ -n "$users" ]  && printf '    <txt-record>users=%s</txt-record>\n' "$(esc "$users")"
    echo '  </service>'
    echo '</service-group>'
  } > "$tmp"
  mv "$tmp" "$SERVICE_FILE"
}

remove_service() {
  [ -f "$SERVICE_FILE" ] && rm -f "$SERVICE_FILE" || true
}

# Clean up the advertisement on exit.
trap 'remove_service; exit 0' INT TERM

echo "[mdns] advertising _foundryvtt._tcp on port ${PORT}; polling ${STATUS_URL} every ${REFRESH}s"

while true; do
  if json="$(curl -fsS --max-time 5 "$STATUS_URL" 2>/dev/null)"; then
    world=$(printf '%s' "$json"  | jq -r '.world // empty'                      2>/dev/null || echo "")
    system=$(printf '%s' "$json" | jq -r '.system // empty'                     2>/dev/null || echo "")
    sysver=$(printf '%s' "$json" | jq -r '.systemVersion // empty'              2>/dev/null || echo "")
    core=$(printf '%s' "$json"   | jq -r '.coreVersion // .version // empty'    2>/dev/null || echo "")
    users=$(printf '%s' "$json"  | jq -r '(.users // empty) | tostring'         2>/dev/null || echo "")
    active=$(printf '%s' "$json" | jq -r 'if .active == true then "1" else "0" end' 2>/dev/null || echo "1")
    title="$WORLD_TITLE_ENV"
    [ -z "$title" ] && title="$world"
    write_service "$world" "$title" "$system" "$sysver" "$core" "$active" "$users"
  else
    # Foundry not reachable / no active world → withdraw the advertisement.
    remove_service
  fi
  sleep "$REFRESH"
done
