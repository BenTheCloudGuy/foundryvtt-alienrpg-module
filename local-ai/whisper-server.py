"""
whisper-server.py — OpenAI-compatible STT API backed by faster-whisper

Endpoints:
  POST /v1/audio/transcriptions  — Transcribe audio file to text
  GET  /health                   — Health check

Request (multipart/form-data, matches OpenAI Whisper API):
  file:   audio file (wav, mp3, webm, ogg, etc.)
  model:  ignored (uses WHISPER_MODEL env)
  language: optional language code (default: en)

Response:
  { "text": "transcribed text here" }

Environment:
  WHISPER_MODEL   Whisper model size (tiny.en, base.en, small.en, medium.en)
                  Default: base.en (~150MB, good speed/accuracy balance)
"""
import os
import tempfile
from flask import Flask, request, jsonify
from faster_whisper import WhisperModel

app = Flask(__name__)

MODEL_NAME = os.environ.get("WHISPER_MODEL", "base.en")
MODELS_DIR = "/app/models"

# Load model at startup
app.logger.info(f"Loading Whisper model: {MODEL_NAME}")
model = WhisperModel(
    MODEL_NAME,
    device="cpu",
    compute_type="int8",
    download_root=MODELS_DIR,
)
app.logger.info(f"Whisper model '{MODEL_NAME}' loaded.")


@app.route("/v1/audio/transcriptions", methods=["POST"])
def transcribe():
    if "file" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["file"]
    language = request.form.get("language", "en")

    # Save uploaded file to a temp path for faster-whisper
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        audio_file.save(tmp)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            vad_filter=True,
        )

        # Collect all segments into full text
        text = " ".join(seg.text.strip() for seg in segments)

        return jsonify({
            "text": text,
            "language": info.language,
            "duration": info.duration,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_NAME})


if __name__ == "__main__":
    app.logger.info("Whisper STT server starting on port 9000")
    app.run(host="0.0.0.0", port=9000)
