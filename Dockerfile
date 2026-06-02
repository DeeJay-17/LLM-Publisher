FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build


FROM python:3.11-slim-bookworm AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates zstd && rm -rf /var/lib/apt/lists/*

# Install cloudflared (multi-arch download)
RUN ARCH="$(dpkg --print-architecture)" && \
  if [ "$ARCH" = "arm64" ]; then CF_ARCH="arm64"; else CF_ARCH="amd64"; fi && \
  curl -fsSL -o /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" && \
  chmod +x /usr/local/bin/cloudflared

# Install Ollama (Linux) inside the container.
# Ollama distributes Linux builds as .tar.zst archives.
RUN ARCH="$(dpkg --print-architecture)" && \
  if [ "$ARCH" = "arm64" ]; then OL_ARCH="arm64"; else OL_ARCH="amd64"; fi && \
  curl -fsSL "https://ollama.com/download/ollama-linux-${OL_ARCH}.tar.zst" | tar --use-compress-program=unzstd -x -C /usr/local && \
  chmod +x /usr/local/bin/ollama || true

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist/ ./backend/static/
COPY docker/entrypoint.sh /entrypoint.sh

WORKDIR /app/backend

ENV PORT=8080
# Container runs its own Ollama.
ENV OLLAMA_BASE_URL=http://127.0.0.1:11434
ENV ALLOW_START_OLLAMA_SERVE=true
ENV OLLAMA_HOST=0.0.0.0:11434

EXPOSE 8080
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]

