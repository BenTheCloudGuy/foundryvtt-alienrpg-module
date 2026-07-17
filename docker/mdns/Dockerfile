# mDNS advertiser sidecar for FoundryVTT
#
# Advertises the running FoundryVTT server as `_foundryvtt._tcp` on the LAN so
# the AlienPi launcher (avahi-browse) can list games by name instantly.
#
# WHY A SIDECAR (and not baked into the Foundry image)?
#   - mDNS multicast does not cross Docker's default bridge network, so it must
#     run with `network_mode: host`.
#   - The Foundry container needs a fixed `hostname:` for license binding, but
#     `network_mode: host` forbids both `hostname:` and `ports:`. Putting Avahi
#     in the Foundry container would therefore break licensing.
#   - A separate host-networked sidecar sidesteps the conflict: it queries the
#     host-published port (30000) via `/api/status` and advertises on the LAN.
#
# NOTE: Host networking only exposes to the LAN on Linux hosts. On Docker
# Desktop (Windows/macOS) it is a no-op; the launcher's port-scan fallback still
# discovers the server there.
FROM alpine:3.20

RUN apk add --no-cache avahi avahi-tools dbus curl jq

COPY docker/mdns/advertise.sh /usr/local/bin/advertise.sh
RUN chmod +x /usr/local/bin/advertise.sh

ENTRYPOINT ["/usr/local/bin/advertise.sh"]
