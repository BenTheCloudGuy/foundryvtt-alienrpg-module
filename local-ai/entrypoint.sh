#!/bin/bash
###############################################################################
# entrypoint.sh — Start Ollama server and pull default model on first run
#
# Environment variables:
#   OLLAMA_MODEL    Model to pull on first start (default: llama3.1:8b)
#   OLLAMA_HOST     Bind address (default: 0.0.0.0)
###############################################################################
set -e

MODEL="${OLLAMA_MODEL:-llama3.1:8b}"

echo "=== WY-Terminal LocalAI — Ollama Entrypoint ==="
echo "Model:  ${MODEL}"
echo "Host:   ${OLLAMA_HOST:-0.0.0.0}"

# Start Ollama server in the background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
for i in $(seq 1 60); do
    if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama is ready."
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "ERROR: Ollama failed to start within 60 seconds."
        exit 1
    fi
    sleep 1
done

# Pull the model if not already present
if ! ollama list | grep -q "${MODEL}"; then
    echo "Pulling model: ${MODEL} (this may take a while on first run)..."
    ollama pull "${MODEL}"
    echo "Model ${MODEL} pulled successfully."
else
    echo "Model ${MODEL} already available."
fi

echo "=== Ollama ready — serving on port 11434 ==="

# Keep the server in the foreground
wait $OLLAMA_PID
