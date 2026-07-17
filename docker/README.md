# FoundryVTT + Alien RPG Docker image

A Docker image that brings up **FoundryVTT** with the **Alien RPG** game system
and the **Weyland-Yutani Ship Terminal** (`wy-terminal`) module **fully
configured and ready to play — with no clicking required.**

On first start the container will, end to end:

1. **Download & install FoundryVTT** (via the `felddy/foundryvtt` base, using your account)
2. **Install your licence**
3. **Install the Alien RPG game system**
4. **Install the `wy-terminal` module** (and auto-enable it)
5. **Create an Alien RPG game world** (`alienrpg-cog`)
6. **Launch that world automatically**

Published to Docker Hub as **`benthebuilder/foundryvtt-alienrpg`**.

> **FoundryVTT is proprietary.** This image is built on
> [`felddy/foundryvtt`](https://hub.docker.com/r/felddy/foundryvtt), which
> downloads and licenses FoundryVTT **at container start-up** using *your* own
> account. The FoundryVTT application is **not** redistributed in this image —
> only the (open-source) Alien RPG system and the `wy-terminal` module are baked
> in. Supplying your credentials once (via env vars or Docker secrets) is the
> only input required; there is no interactive setup.

## What's inside

| Component | Source |
|-----------|--------|
| FoundryVTT | Downloaded & licensed at runtime by the `felddy/foundryvtt` base using your credentials |
| Alien RPG system (`alienrpg`) | https://github.com/pwatson100/alienrpg (latest release) |
| `wy-terminal` module | This repository |
| Alien RPG world (`alienrpg-cog`) | Created automatically on first boot |

## How the automation works

Because the `felddy/foundryvtt` base declares `VOLUME ["/data"]`, content
cannot be reliably baked directly into `/data` at build time (Docker discards
build-time writes to a declared volume). Instead:

- The system and module are baked into a non-volume path (`/opt/alienrpg/content`).
- A start-up patch script (`docker/patches/00-install-alienrpg.sh`, wired via
  the `CONTAINER_PATCHES` environment variable) runs **after Foundry is
  installed but before it launches**. It copies the content into
  `/data/Data/{systems,modules}`, writes the world manifest with the correct
  `coreVersion`/`systemVersion` (so Foundry never prompts for a migration), and
  best-effort pre-enables the module.
- `FOUNDRY_WORLD=alienrpg-cog` tells the base image to launch the world.

## Run it (one command)

The easiest path is the bundled Compose file:

```bash
cp docker/.env.example docker/.env   # then edit docker/.env with your credentials
docker compose -f docker/compose.yml up --build
```

Or with plain `docker run` (credentials used once, at start-up, to download and
license Foundry):

```bash
docker run --rm -it \
  --name foundry-alienrpg \
  --hostname foundry-alienrpg \
  -p 30000:30000 \
  -e FOUNDRY_USERNAME="you@example.com" \
  -e FOUNDRY_PASSWORD="your-password" \
  -e FOUNDRY_LICENSE_KEY="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" \
  -v foundry-data:/data \
  benthebuilder/foundryvtt-alienrpg:latest
```

Then open <http://localhost:30000> — the Alien RPG world is already running.

> **Set a stable `--hostname`** (as above). FoundryVTT binds its licence to the
> container hostname; without a fixed hostname, licence verification fails after
> each restart.

> **Volumes:** Content and the world are staged into `/data` on first boot. Use
> a named volume (as above) or an empty directory the first time so the staging
> runs cleanly. Existing systems/modules/worlds are left untouched on
> subsequent starts, so your game data is preserved.

## Build locally

Run from the **repository root** (the Dockerfile expects the repo as its build
context):

```bash
docker build -f docker/Dockerfile -t benthebuilder/foundryvtt-alienrpg:local .
```

### Build arguments

| Arg | Default | Purpose |
|-----|---------|---------|
| `FOUNDRY_VERSION` | `13` | Tag of the `felddy/foundryvtt` base image (e.g. `13`, `14`, `release`). Pinned to `13` to match the module's declared compatibility. |
| `ALIENRPG_MANIFEST_URL` | `.../releases/latest/download/system.json` | Alien RPG system manifest to install |

Example targeting a different Foundry major version:

```bash
docker build -f docker/Dockerfile \
  --build-arg FOUNDRY_VERSION=14 \
  -t benthebuilder/foundryvtt-alienrpg:local .
```

## CI / publishing

Images are built and pushed to Docker Hub by
[`.github/workflows/docker-image.yml`](../.github/workflows/docker-image.yml).

Required repository secrets:

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username (`benthebuilder`) |
| `DOCKERHUB_TOKEN` | Docker Hub access token with write scope |
