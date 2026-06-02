import React from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Link,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import PublicIcon from '@mui/icons-material/Public'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import { fetchStatus, publish, pullModel, stop, type StatusResponse } from './api'

function useInterval(callback: () => void, delayMs: number | null) {
  React.useEffect(() => {
    if (delayMs === null) return
    const id = window.setInterval(callback, delayMs)
    return () => window.clearInterval(id)
  }, [callback, delayMs])
}

export function App() {
  const [status, setStatus] = React.useState<StatusResponse | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [modelName, setModelName] = React.useState('llama3:latest')
  const [toast, setToast] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      const s = await fetchStatus()
      setStatus(s)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  useInterval(
    () => {
      refresh()
    },
    1500,
  )

  const onPublish = async () => {
    setBusy(true)
    try {
      const res = await publish()
      await refresh()
      const copied = await navigator.clipboard.writeText(res.public_url).then(
        () => true,
        () => false,
      )
      setToast(copied ? 'Public URL copied to clipboard.' : 'Published.')
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  const onStop = async () => {
    setBusy(true)
    try {
      await stop()
      await refresh()
      setToast('Stopped.')
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  const publishState = status?.publish
  const publicUrl = publishState?.public_url ?? null

  const ollamaOk = status?.ollama_reachable ?? false
  const networkOk = status?.ollama_network_reachable
  const hasModels = (status?.models ?? []).length > 0
  const modelInstall = status?.model_install
  const publishError = publishState?.last_error ?? null

  const onInstallModel = async () => {
    const name = modelName.trim()
    if (!name) return
    setBusy(true)
    try {
      await pullModel(name)
      await refresh()
      setToast(`Installing model: ${name}`)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(77,163,255,0.14)',
        }}
      >
        <Toolbar sx={{ py: 2.25, justifyContent: 'center' }}>
          <Box
            sx={{
              textAlign: 'center',
              maxWidth: 'min(820px, 74vw)',
            }}
          >
            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                letterSpacing: -0.8,
                lineHeight: 1.1,
              }}
            >
              LLM Publisher
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75, display: { xs: 'none', sm: 'block' } }}>
              Publish your local Ollama server globally via a Cloudflare quick tunnel.
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ pt: 5, pb: 2, flex: 1 }}>
        <Stack spacing={2}>
          {toast ? (
            <Alert severity="info" onClose={() => setToast(null)}>
              {toast}
            </Alert>
          ) : null}

          {error ? (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          ) : null}

          <Grid container spacing={2} alignItems="stretch">
            {/* Step 1 */}
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Card variant="outlined" sx={{ width: '100%' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Step 1 — Ollama
                      </Typography>
                      <Chip
                        label={ollamaOk ? 'Reachable' : 'Not reachable'}
                        color={ollamaOk ? 'success' : 'error'}
                        variant="filled"
                        size="small"
                      />
                    </Stack>

                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650, letterSpacing: 0.2 }}>
                        Base URL
                      </Typography>
                      <Box
                        sx={{
                          mt: 0.75,
                          px: 1.25,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: 'rgba(77,163,255,0.08)',
                          border: '1px solid rgba(77,163,255,0.18)',
                          fontFamily: 'monospace',
                          fontSize: 16,
                          lineHeight: 1.4,
                          wordBreak: 'break-all',
                        }}
                      >
                        {status?.ollama_base_url ?? '—'}
                      </Box>
                    </Box>

                    {ollamaOk && networkOk === false ? (
                      <Alert severity="warning">
                        Ollama is running, but it doesn’t look reachable on your LAN. Open Ollama settings and enable the
                        option to <b>expose / listen on network</b> if you need LAN access.
                      </Alert>
                    ) : null}

                    {!ollamaOk ? (
                      <Alert severity="error">
                        Ollama server isn’t reachable. Install Ollama and open it once so the server starts.
                      </Alert>
                    ) : null}

                    {!ollamaOk ? (
                      <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
                        <CardContent>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              Install Ollama
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              If you don’t have Ollama yet, install it first.
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Button
                                variant="contained"
                                startIcon={<DownloadIcon />}
                                component={Link}
                                href="https://ollama.com/download"
                                target="_blank"
                                rel="noreferrer"
                              >
                                Download
                              </Button>
                              <Button
                                variant="outlined"
                                startIcon={<ContentCopyIcon />}
                                onClick={() => navigator.clipboard.writeText('brew install ollama').catch(() => {})}
                              >
                                Copy brew command
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Step 2 */}
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Card variant="outlined" sx={{ width: '100%' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Step 2 — Models on this Ollama
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ollama publishes all installed models on one server. The model is selected per request.
                    </Typography>

                    {(status?.models ?? []).length === 0 ? (
                      <Alert severity="info">No models found yet.</Alert>
                    ) : (
                      <Stack spacing={1}>
                        {status!.models.map((m) => (
                          <Card key={m.name} variant="outlined" sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                            <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Typography sx={{ fontFamily: 'monospace', fontWeight: 650 }}>{m.name}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {m.size ?? ''}
                                </Typography>
                              </Stack>
                              {m.modified ? (
                                <Typography variant="caption" color="text.secondary">
                                  Modified: {m.modified}
                                </Typography>
                              ) : null}
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}

                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Step 3 */}
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Card variant="outlined" sx={{ width: '100%' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Step 3 — Install a model (if needed)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This downloads to the machine running Ollama.
                    </Typography>

                    {!ollamaOk ? (
                      <Alert severity="info">Install/Start Ollama first (Step 1).</Alert>
                    ) : hasModels ? (
                      <Alert severity="success">You already have models installed. You can publish in Step 4.</Alert>
                    ) : (
                      <Alert severity="warning">
                        No models are installed. Install one to continue.
                        <Divider sx={{ my: 1.5, opacity: 0.15 }} />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
                          <TextField
                            label="Model name"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            placeholder="e.g. llama3:latest"
                            size="small"
                            fullWidth
                            inputProps={{ style: { fontFamily: 'monospace' } }}
                            disabled={busy}
                          />
                          <Button
                            variant="contained"
                            onClick={onInstallModel}
                            disabled={busy || !modelName.trim() || modelInstall?.status === 'installing'}
                          >
                            {modelInstall?.status === 'installing' ? 'Installing…' : 'Install'}
                          </Button>
                        </Stack>
                      </Alert>
                    )}

                    {modelInstall?.last_error ? <Alert severity="error">{modelInstall.last_error}</Alert> : null}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Step 4 */}
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Card variant="outlined" sx={{ width: '100%' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Step 4 — Publish globally
                      </Typography>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          variant="contained"
                          startIcon={<PublicIcon />}
                          onClick={onPublish}
                          disabled={busy || !ollamaOk}
                        >
                          {publishState?.status === 'starting' ? 'Publishing…' : 'Publish'}
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<StopCircleIcon />}
                          onClick={onStop}
                          disabled={busy || !publishState || !publicUrl}
                        >
                          Stop
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<ContentCopyIcon />}
                          onClick={() =>
                            publicUrl
                              ? navigator.clipboard
                                  .writeText(publicUrl)
                                  .then(() => setToast('Public URL copied to clipboard.'))
                                  .catch(() => setToast('Could not copy URL.'))
                              : undefined
                          }
                          disabled={!publicUrl}
                        >
                          Copy URL
                        </Button>
                      </Stack>
                    </Stack>

                    {publicUrl ? (
                      <Alert severity="success">
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Public URL
                        </Typography>
                        <Box sx={{ fontFamily: 'monospace', mt: 0.5, wordBreak: 'break-all' }}>{publicUrl}</Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Share this URL. Your Ollama API is available at this address.
                        </Typography>
                      </Alert>
                    ) : null}

                    {publishError ? <Alert severity="error">{publishError}</Alert> : null}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ width: '100%' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Logs
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Detailed output from installs and tunnels (for troubleshooting).
                    </Typography>

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Accordion variant="outlined" sx={{ bgcolor: 'transparent' }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="body2" color="text.secondary">
                              Model install logs
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box
                              component="pre"
                              sx={{
                                m: 0,
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: 'rgba(0,0,0,0.35)',
                                border: '1px solid rgba(255,255,255,0.10)',
                                overflow: 'auto',
                                maxHeight: 320,
                                fontSize: 12,
                              }}
                            >
                              {(modelInstall?.logs ?? []).slice(-200).join('\n') || 'No logs yet.'}
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Accordion variant="outlined" sx={{ bgcolor: 'transparent' }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="body2" color="text.secondary">
                              Cloudflared logs
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box
                              component="pre"
                              sx={{
                                m: 0,
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: 'rgba(0,0,0,0.35)',
                                border: '1px solid rgba(255,255,255,0.10)',
                                overflow: 'auto',
                                maxHeight: 320,
                                fontSize: 12,
                              }}
                            >
                              {(publishState?.logs ?? []).slice(-200).join('\n') || 'No logs yet.'}
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      </Grid>
                    </Grid>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ textAlign: 'center', color: 'text.secondary', pt: 1 }}>
            <Typography variant="caption">
              Runs locally. Publishing uses Cloudflare quick tunnels (trycloudflare.com).
            </Typography>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}

