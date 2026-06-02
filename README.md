# LLM Publisher (Ollama + Cloudflare Tunnel)

Publish your local Ollama server globally using Cloudflare **quick tunnels** (`trycloudflare.com`) with a simple UI.

## What this does

- Checks whether **Ollama** is running and reachable.
- Lists which models are installed (these are what will be available after publishing).
- Creates a **temporary public URL** using `cloudflared tunnel --url ...`.
- Shows the **public URL** and live logs in the UI, and lets you stop the tunnel.

## Before you start (1 minute)

### 1) Install Ollama

- Download: `https://ollama.com/download`
- Or via Homebrew:

```bash
brew install ollama
```

### 2) Start Ollama once

- Open **Ollama Desktop** (or run Ollama so the server starts).
- Ollama’s API is typically available at `http://localhost:11434`.

### 3) Install at least one model

Example:

```bash
ollama pull llama3:latest
```

If you don’t know what to choose, `llama3:latest` is a good default for testing.

## Run the app (recommended: Docker)

### Step A — Build

```bash
docker build -t llm-publisher .
```

### Step B — Run

You have **two ways** to run with Docker:

#### Option 1 (recommended): run Ollama *inside* the container

This is the most “ready-to-go” option. Models will live in the container unless you mount a volume.

```bash
docker run --rm -p 8080:8080 llm-publisher
```

To reuse your **existing host models** (macOS), mount your Ollama model folder:

```bash
docker run --rm -p 8080:8080 \
  -v "$HOME/.ollama:/root/.ollama" \
  llm-publisher
```

#### Option 2: use Ollama running on your host machine (use host models automatically)

If you already have Ollama + models on the host, you can point the app at it and skip running Ollama in-container:

```bash
docker run --rm -p 8080:8080 \
  -e START_OLLAMA=false \
  -e OLLAMA_BASE_URL="http://host.docker.internal:11434" \
  -e ALLOW_START_OLLAMA_SERVE=false \
  llm-publisher
```

### Step C — Open the UI

- Open `http://localhost:8080`

## Use the UI (follow the 4 steps)

### Step 1 — Ollama

- If the UI says **Not reachable**, install Ollama and open it once.
- Optional: if you need LAN access, open Ollama settings and enable the option to **expose / listen on network**.

### Step 2 — Models

- You should see a list of installed models.
- Ollama publishes all models from a single server; the model is chosen per request.

### Step 3 — Install a model (if needed)

- If no models are installed, enter a model name (example: `llama3:latest`) and click **Install**.
- This downloads to the machine running Ollama.

### Step 4 — Publish globally

- Click **Publish**.
- You’ll get a `https://<something>.trycloudflare.com` public URL.
- Share the URL with others (they can call the Ollama HTTP API through it).

## Test the public URL (quick checks)

Replace `$PUBLIC_URL` with the URL from the UI.

### Check version

```bash
curl "$PUBLIC_URL/api/version"
```

### List tags/models

```bash
curl "$PUBLIC_URL/api/tags"
```

### Run a quick generate

```bash
curl "$PUBLIC_URL/api/generate" \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3:latest","prompt":"Say hello in one sentence.","stream":false}'
```

## Important notes (read this)

### Quick tunnels are temporary

Cloudflare quick tunnels are designed for experiments:
- No uptime guarantees
- URL changes when you restart

### Docker + Ollama on macOS

If you use **Option 2** (host Ollama), the container reaches your host at:
- `http://host.docker.internal:11434`

If Step 1 shows “Not reachable”:
- Ensure Ollama is running on your Mac
- Confirm this works on the host:

```bash
curl http://localhost:11434/api/version
```

If Step 2 shows “No models found”:
- You are likely running **Option 1** without mounting `~/.ollama`
- Either mount your host models (`-v "$HOME/.ollama:/root/.ollama"`) or switch to Option 2

### Security

Publishing exposes your Ollama API to the internet. Anyone with the URL can:
- List models
- Run prompts (costs CPU/GPU and can consume bandwidth)

Use only for demos / controlled sharing.

## Dev run (no Docker)

This is helpful if you want hot-reload.

### Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

### Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev
```

Open:
- Frontend dev server prints its URL (typically `http://localhost:5173`)
- Backend runs at `http://localhost:8080`

## Troubleshooting

### “Ollama not reachable”

- Open Ollama Desktop once
- On the host, verify:

```bash
curl http://localhost:11434/api/version
```

### “No models found”

- Pull one model:

```bash
ollama pull llama3:latest
```

### “Publish timed out / no public URL”

- Ensure `cloudflared` can run (it is bundled in Docker)
- Check the **Cloudflared logs** section in the UI

