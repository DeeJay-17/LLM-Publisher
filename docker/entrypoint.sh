#!/usr/bin/env sh
set -eu

echo "[entrypoint] starting ollama serve..."
OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0:11434}" ollama serve >/var/log/ollama.log 2>&1 &

echo "[entrypoint] waiting for ollama..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:11434/api/version" >/dev/null 2>&1; then
    echo "[entrypoint] ollama is up"
    break
  fi
  sleep 0.25
done

echo "[entrypoint] starting api server..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}"

