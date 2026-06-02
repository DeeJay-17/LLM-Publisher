#!/usr/bin/env sh
set -eu

START_OLLAMA="${START_OLLAMA:-true}"
OLLAMA_HEALTH_URL="${OLLAMA_HEALTH_URL:-http://127.0.0.1:11434/api/version}"

if [ "$START_OLLAMA" = "true" ]; then
  echo "[entrypoint] starting ollama serve..."
  OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0:11434}" ollama serve >/var/log/ollama.log 2>&1 &

  echo "[entrypoint] waiting for ollama..."
  for i in $(seq 1 80); do
    if curl -fsS "$OLLAMA_HEALTH_URL" >/dev/null 2>&1; then
      echo "[entrypoint] ollama is up"
      break
    fi
    sleep 0.25
  done
else
  echo "[entrypoint] START_OLLAMA=false (will use external Ollama at OLLAMA_BASE_URL)"
fi

echo "[entrypoint] starting api server..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}"

