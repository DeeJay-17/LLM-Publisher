FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build


FROM python:3.11-slim-bookworm AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install cloudflared (multi-arch download)
RUN ARCH="$(dpkg --print-architecture)" && \
  if [ "$ARCH" = "arm64" ]; then CF_ARCH="arm64"; else CF_ARCH="amd64"; fi && \
  curl -fsSL -o /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" && \
  chmod +x /usr/local/bin/cloudflared

# Install ollama binary (Linux) so the container can run it too if desired
RUN ARCH="$(dpkg --print-architecture)" && \
  if [ "$ARCH" = "arm64" ]; then OL_ARCH="arm64"; else OL_ARCH="amd64"; fi && \
  curl -fsSL -o /usr/local/bin/ollama "https://ollama.com/download/ollama-linux-${OL_ARCH}" && \
  chmod +x /usr/local/bin/ollama

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist/ ./backend/static/

WORKDIR /app/backend

ENV PORT=8080
# In Docker on macOS, the host's Ollama is reachable here:
ENV OLLAMA_BASE_URL=http://host.docker.internal:11434
ENV ALLOW_START_OLLAMA_SERVE=false

EXPOSE 8080
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

