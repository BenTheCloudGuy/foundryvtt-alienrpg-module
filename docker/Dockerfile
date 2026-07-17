# syntax=docker/dockerfile:1

###############################################################################
# FoundryVTT + Alien RPG image — end-to-end, zero-interaction
#
# Builds on the community felddy/foundryvtt base image and automates the whole
# chain so the container comes up ready to play:
#
#   1. Download & install FoundryVTT      (felddy base, at container start)
#   2. Install the licence                (felddy base, at container start)
#   3. Install the Alien RPG game system  (baked in, staged on first boot)
#   4. Install the wy-terminal module     (baked in, staged on first boot)
#   5. Create an Alien RPG game world     (container patch, on first boot)
#   6. Launch that world automatically    (FOUNDRY_WORLD)
#
# Steps 1-2 are performed at start-up by the felddy base using YOUR own
# FoundryVTT account. FoundryVTT is proprietary and its licence forbids
# redistribution, so it is never baked into this image — you supply
# FOUNDRY_USERNAME / FOUNDRY_PASSWORD (and optionally FOUNDRY_LICENSE_KEY)
# once, via environment variables or Docker secrets, and everything else is
# fully automatic with no clicking required.
#
# Steps 3-5 run from a CONTAINER_PATCHES script (docker/patches) because the
# felddy base declares `VOLUME ["/data"]`; build-time writes to /data are
# discarded, so the Alien RPG content is baked into a non-volume path and
# copied into /data when the container first starts.
###############################################################################

# Global ARG (declared before the first FROM) so it can be used in the base
# image reference below. Pinned to Foundry v13 to match the module/system
# compatibility range (module.json declares maximum "13"). Override with
# --build-arg FOUNDRY_VERSION if you need a different major line.
ARG FOUNDRY_VERSION=13

# --- Stage 1: fetch & stage game content -----------------------------------
FROM alpine:3.20 AS content

ARG ALIENRPG_MANIFEST_URL="https://github.com/pwatson100/alienrpg/releases/latest/download/system.json"

RUN apk add --no-cache curl jq unzip

COPY docker/install-content.sh /usr/local/bin/install-content.sh
COPY . /src

RUN chmod +x /usr/local/bin/install-content.sh \
 && /usr/local/bin/install-content.sh "${ALIENRPG_MANIFEST_URL}" /content /src

# --- Stage 2: final image ---------------------------------------------------
FROM felddy/foundryvtt:${FOUNDRY_VERSION}

LABEL org.opencontainers.image.title="FoundryVTT + Alien RPG" \
      org.opencontainers.image.description="FoundryVTT with the Alien RPG system and Weyland-Yutani Ship Terminal module pre-installed, auto-creating and launching an Alien RPG world." \
      org.opencontainers.image.source="https://github.com/BenTheCloudGuy/foundryvtt-alienrpg-module" \
      org.opencontainers.image.licenses="MIT"

# Bake the Alien RPG system + wy-terminal module into a NON-volume path. The
# felddy base declares VOLUME ["/data"], so anything copied into /data at build
# time would be discarded. A start-up patch copies this content into
# /data/Data on first boot instead.
COPY --from=content --chown=node:node /content /opt/alienrpg/content

# Install the start-up patch that stages content, creates the Alien RPG world,
# and pre-enables the module. felddy sources every file in CONTAINER_PATCHES
# after Foundry is installed but before it is launched.
COPY --chown=node:node docker/patches/ /opt/alienrpg/patches/

# Auto-run the patch on every start, and auto-launch the world it creates.
#   CONTAINER_PATCHES  – directory of start-up scripts sourced by the entrypoint
#   FOUNDRY_WORLD      – world directory name to launch automatically
#   FOUNDRY_TELEMETRY  – answer the telemetry prompt so start-up needs no input
ENV CONTAINER_PATCHES=/opt/alienrpg/patches \
    FOUNDRY_WORLD=alienrpg-cog \
    FOUNDRY_TELEMETRY=false
