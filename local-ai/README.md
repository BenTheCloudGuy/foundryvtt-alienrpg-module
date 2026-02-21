# LocalAI — Ollama + Whisper STT

Local AI stack for the WY-Terminal MU/TH/UR engine. LLM chat and speech-to-text run on your machine with no external API calls.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Docker Host                                │
│                                             │
│  ┌────────────────────┐                     │
│  │  Ollama            │                     │
│  │  Ubuntu 22.04      │                     │
│  │  Port: 11434       │                     │
│  │  LLM inference     │                     │
│  │  /v1/chat/complete │                     │
│  └────────────────────┘                     │
│                                             │
│  ┌────────────────────┐                     │
│  │  Whisper STT       │                     │
│  │  Port: 9000        │                     │
│  │  /v1/audio/transcr │                     │
│  │  Audio -> Text     │                     │
│  └────────────────────┘                     │
│                                             │
└─────────────────────────────────────────────┘
         ▲
         │  LLM: http://localhost:11434/v1/chat/completions
         │  STT: http://localhost:9000/v1/audio/transcriptions
         │
    FoundryVTT / WY-Terminal
```

## Requirements

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- NVIDIA GPU + [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) (recommended)
- At least 8GB free RAM (16GB+ recommended)
- ~5GB disk space for the default model

### CPU-Only Mode

If you don't have an NVIDIA GPU, edit `docker-compose.yml` and remove the entire `deploy:` block from the `ollama` service. Models will run on CPU — slower but functional.

## Quick Start

```bash
# Navigate to the local-ai directory inside the module
cd local-ai

# Build and start the stack
docker compose up -d --build

# First run pulls the model (~4.7GB for llama3.1:8b)
# Monitor progress:
docker compose logs -f ollama

# Once "Ollama ready" appears, the stack is live.
```

## Verify It Works

```bash
# Test Ollama directly
curl http://localhost:11434/api/tags

# Test chat completion (OpenAI-compatible, no auth needed)
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Connect to WY-Terminal

In FoundryVTT, open the WY-Terminal module settings and update:

| Setting       | Value                                       |
|---------------|---------------------------------------------|
| API Base URL  | `http://localhost:11434/v1`                 |
| API Key       | Leave blank (Ollama needs no auth)          |
| AI Model      | `llama3.1:8b` (or whichever model you pulled) |

> **Remote players?** The MU/TH/UR engine makes API calls from the
> **browser**.  If players connect from other machines, `localhost` will
> resolve to *their* machine, not the server.  Use the server's LAN IP or
> hostname instead:
>
> ```
> http://<server-ip>:11434/v1
> ```
>
> Make sure Ollama's port (11434) and Whisper's port (9000) are reachable
> from the player's network (firewall / port forwarding).

## Change the Model

Edit `.env` to set a different default model:

```env
OLLAMA_MODEL=mistral:7b
```

Or pull additional models at any time:

```bash
docker compose exec ollama ollama pull phi3:mini
docker compose exec ollama ollama pull llama3.1:70b
```

## Recommended Models for MU/TH/UR

| Model              | Size   | VRAM   | Notes                                     |
|--------------------|--------|--------|-------------------------------------------|
| `llama3.1:8b`      | ~4.7GB | ~6GB   | Best balance of speed and quality          |
| `mistral:7b`       | ~4.1GB | ~6GB   | Fast, good at instruction following        |
| `phi3:mini`        | ~2.3GB | ~4GB   | Lightweight, works on low-end hardware     |
| `llama3.1:70b`     | ~40GB  | ~48GB  | Highest quality, needs serious GPU         |
| `gemma2:9b`        | ~5.4GB | ~7GB   | Google's model, strong reasoning           |

## Data Persistence

Model weights and STT data are stored in Docker volumes:

- `ollama-data` — Downloaded LLM models (~5GB+ per model)
- `whisper-data` — Downloaded Whisper STT models (~150MB for base.en)

To reset everything:

```bash
docker compose down -v
```

## Speech-to-Text (Whisper STT)

Whisper runs a local STT server on port 9000 with an OpenAI-compatible API.

**Test it:**

```bash
curl -X POST http://localhost:9000/v1/audio/transcriptions \
  -F "file=@test.wav" \
  -F "language=en"
```

**Change model size:** Edit `WHISPER_MODEL` in `docker-compose.yml`.

| Model        | Size    | Speed    | Accuracy | Notes                         |
|--------------|---------|----------|----------|-------------------------------|
| `tiny.en`    | ~40MB   | Fastest  | Lower    | Good for short clear speech   |
| `base.en`    | ~150MB  | Fast     | Good     | Default, best speed/accuracy  |
| `small.en`   | ~500MB  | Medium   | Better   | Noticeably more accurate      |
| `medium.en`  | ~1.5GB  | Slower   | High     | Best accuracy on CPU          |

## API Endpoints Summary

| Service     | Endpoint                     | Port  | Auth |
|-------------|------------------------------|-------|------|
| Ollama      | `/v1/chat/completions`       | 11434 | None |
| Whisper STT | `/v1/audio/transcriptions`   | 9000  | None |

## Troubleshooting

**Ollama won't start (no GPU)**
Remove the `deploy:` block from `docker-compose.yml`. CPU inference works but is ~10x slower.

**Model pull is slow**
The first pull downloads the full model weights. Subsequent starts reuse the cached weights from the Docker volume.

**Port conflicts**
Change the host ports in `docker-compose.yml`:
- Ollama: `"11434:11434"` → `"<new-port>:11434"`
- Whisper STT: `"9000:9000"` → `"<new-port>:9000"`
