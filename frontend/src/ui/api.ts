export type PublishState = {
  status: 'idle' | 'starting' | 'published' | 'error' | 'stopped'
  public_url?: string | null
  last_error?: string | null
  logs: string[]
}

export type OllamaModel = {
  name: string
  size?: string | null
  modified?: string | null
}

export type StatusResponse = {
  ollama_reachable: boolean
  ollama_network_reachable?: boolean | null
  ollama_base_url: string
  ollama_cli_available: boolean
  models: OllamaModel[]
  publish: PublishState
  model_install: {
    status: 'idle' | 'installing' | 'installed' | 'error'
    model?: string | null
    last_error?: string | null
    logs: string[]
  }
}

export async function fetchStatus(): Promise<StatusResponse> {
  const r = await fetch('/api/status')
  if (!r.ok) throw new Error(await r.text())
  return await r.json()
}

export async function publish(): Promise<{ public_url: string }> {
  const r = await fetch('/api/publish', { method: 'POST' })
  if (!r.ok) {
    const body = await r.json().catch(() => null)
    throw new Error(body?.detail ?? 'Publish failed')
  }
  return await r.json()
}

export async function stop(): Promise<void> {
  const r = await fetch('/api/stop', { method: 'POST' })
  if (!r.ok) throw new Error(await r.text())
}

export async function pullModel(name: string): Promise<void> {
  const r = await fetch('/api/models/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => null)
    throw new Error(body?.detail ?? 'Model install failed')
  }
}

