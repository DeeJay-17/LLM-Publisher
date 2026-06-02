from __future__ import annotations

import asyncio
import logging
from typing import Optional

from app.domain.models import PublishState
from app.services.cloudflared_service import CloudflaredService
from app.services.ollama_service import OllamaService

log = logging.getLogger(__name__)


class PublisherManager:
    def __init__(
        self,
        ollama: OllamaService,
        cloudflared: CloudflaredService,
        *,
        allow_start_ollama_serve: bool,
    ) -> None:
        self._ollama = ollama
        self._cloudflared = cloudflared
        self._allow_start_ollama_serve = allow_start_ollama_serve
        self._state = PublishState()
        self._lock = asyncio.Lock()

    def snapshot(self) -> PublishState:
        st = self._state.model_copy(deep=True)
        st.logs = self._cloudflared.logs()
        st.public_url = self._cloudflared.public_url
        return st

    async def publish(self) -> str:
        async with self._lock:
            if self._cloudflared.is_running() and self._cloudflared.public_url:
                self._state.status = "published"
                self._state.public_url = self._cloudflared.public_url
                self._state.last_error = None
                return self._cloudflared.public_url

            self._state.status = "starting"
            self._state.last_error = None

            try:
                if self._allow_start_ollama_serve:
                    await self._ollama.ensure_serving()
                else:
                    if not await self._ollama.is_reachable():
                        raise RuntimeError("Ollama is not reachable.")

                # Cloudflared should point to the same base URL that clients will hit (localhost in host mode,
                # host.docker.internal in Docker mode, etc.). Cloudflare connects to the local service from inside
                # the backend runtime environment.
                res = await self._cloudflared.start_quick_tunnel(self._ollama.base_url)
                self._state.status = "published"
                self._state.public_url = res.public_url
                return res.public_url
            except Exception as e:
                self._state.status = "error"
                self._state.last_error = str(e)
                log.exception("Publish failed")
                raise

    async def stop(self) -> None:
        async with self._lock:
            await self._cloudflared.stop()
            self._state.status = "stopped"
            self._state.public_url = None

