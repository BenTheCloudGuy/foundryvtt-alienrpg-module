# Dev Container — wy-terminal (Weyland-Yutani Ship Terminal)

This directory contains a VS Code Dev Container / GitHub Codespaces configuration
for developing the **wy-terminal** FoundryVTT module.

---

## What's included

| File | Purpose |
|------|---------|
| `devcontainer.json` | Container definition (Node 20 image, port forwarding) |
| `scripts/start-foundry.sh` | Helper script to start the FoundryVTT server |

---

## Prerequisites

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (local) **or** a [GitHub Codespace](https://github.com/features/codespaces)
* A licensed copy of **FoundryVTT** (v12 or v13) downloaded as the Linux/Node archive from [foundryvtt.com](https://foundryvtt.com)

> **FoundryVTT is proprietary software.**  
> Do **not** commit the server files to this repository.  
> They are excluded by `.gitignore`.

---

## Setup

### 1. Supply FoundryVTT server files

Download the **FoundryVTT Linux/Node** zip from your account at
[foundryvtt.com](https://foundryvtt.com) and unzip it so the directory
layout looks like this:

```
<repo-root>/
└── .foundry/
    └── server/
        ├── resources/
        │   └── app/
        │       └── main.js   ← FoundryVTT Node entry-point
        └── …
```

Quick example (adjust the filename to match the version you downloaded):

```bash
# Run from the repository root
mkdir -p .foundry/server
unzip ~/Downloads/FoundryVTT-12.331.zip -d .foundry/server
```

### 2. Open the dev container

**VS Code (local):**
1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
2. Open the repository folder.
3. Press `F1` → **Dev Containers: Reopen in Container**.

**GitHub Codespaces:**
1. Click **Code → Codespaces → Create codespace on main**.
2. Upload / copy your `.foundry/server/` files into the codespace
   (VS Code Explorer drag-and-drop, or `gh cs cp`).

### 3. Start FoundryVTT

Inside the container terminal:

```bash
bash .devcontainer/scripts/start-foundry.sh
```

The script will:
* Validate that `.foundry/server/resources/app/main.js` exists.
* Create a **symlink** from `.foundry/data/Data/modules/wy-terminal` →
  repository root, so Foundry picks up the module automatically.
* Start the server bound to `0.0.0.0` on port **30000**.

---

## Accessing FoundryVTT

| Environment | URL |
|-------------|-----|
| Local dev container | `http://localhost:30000` |
| GitHub Codespaces | The forwarded-port URL shown in the **Ports** panel (port 30000 is marked **public** automatically) |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FOUNDRY_PORT` | `30000` | Port FoundryVTT listens on |

Example — use a custom port:

```bash
FOUNDRY_PORT=8080 bash .devcontainer/scripts/start-foundry.sh
```

> If you change the port, update `forwardPorts` in `devcontainer.json` to
> match.

---

## Directory layout (gitignored)

```
.foundry/
├── server/   # FoundryVTT application files (user-supplied, not committed)
└── data/     # Runtime data: worlds, settings, etc. (generated, not committed)
```

Both `.foundry/server/` and `.foundry/data/` are excluded by `.gitignore`.
