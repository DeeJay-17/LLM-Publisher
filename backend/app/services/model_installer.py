from __future__ import annotations

import asyncio
import logging
from collections import deque
from dataclasses import dataclass
from typing import Deque, Optional

from app.domain.models import ModelInstallState
from app.services.ollama_service import OllamaService

log = logging.getLogger(__name__)


@dataclass
class InstallResult:
    model: str


class ModelInstaller:
    """
    Runs model pulls in the background and exposes progress/logs for the UI.
    """

    def __init__(self, ollama: OllamaService, max_logs: int = 800) -> None:
        self._ollama = ollama
        self._state = ModelInstallState()
        self._logs: Deque[str] = deque(maxlen=max_logs)
        self._lock = asyncio.Lock()
        self._task: Optional[asyncio.Task[None]] = None

    def snapshot(self) -> ModelInstallState:
        st = self._state.model_copy(deep=True)
        st.logs = list(self._logs)
        return st

    async def start_install(self, model: str) -> InstallResult:
        async with self._lock:
            if self._task and not self._task.done():
                raise RuntimeError("A model is already installing. Please wait.")

            self._logs.clear()
            self._state.status = "installing"
            self._state.model = model
            self._state.last_error = None

            self._task = asyncio.create_task(self._run_install(model))
            return InstallResult(model=model)

    async def _run_install(self, model: str) -> None:
        try:
            if not await self._ollama.is_reachable():
                raise RuntimeError("Ollama is not reachable. Start Ollama first.")

            logs = await self._ollama.pull_model(model)
            for ln in logs:
                self._logs.append(ln)

            self._state.status = "installed"
        except Exception as e:
            self._state.status = "error"
            self._state.last_error = str(e)
            log.exception("Model install failed")

