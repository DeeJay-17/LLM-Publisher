from __future__ import annotations

import asyncio
import logging
import os
import re
import socket
import subprocess
from shutil import which
from dataclasses import dataclass
from typing import Optional

import httpx

from app.domain.models import OllamaModel

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class OllamaHealth:
    reachable: bool
    network_reachable: Optional[bool] = None


class OllamaService:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    @property
    def base_url(self) -> str:
        return self._base_url

    def cli_available(self) -> bool:
        return which("ollama") is not None

    async def is_reachable(self, timeout_s: float = 1.5) -> bool:
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                r = await client.get(f"{self._base_url}/api/version")
                return r.status_code == 200
        except Exception:
            return False

    async def check_health(self) -> OllamaHealth:
        reachable = await self.is_reachable()

        # Best-effort "network reachable" check (only meaningful when base_url is localhost).
        network_reachable: Optional[bool] = None
        if reachable and self._base_url.startswith("http://localhost"):
            try:
                ip = self._get_lan_ip()
                async with httpx.AsyncClient(timeout=1.5) as client:
                    r = await client.get(f"http://{ip}:11434/api/version")
                    network_reachable = r.status_code == 200
            except Exception:
                network_reachable = False

        return OllamaHealth(reachable=reachable, network_reachable=network_reachable)

    async def list_models(self) -> list[OllamaModel]:
        """
        Uses `ollama list` so the UI can show what will be available after publishing.
        """
        try:
            proc = await asyncio.create_subprocess_exec(
                "ollama",
                "list",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            return await self._list_models_via_http()

        out, _err = await proc.communicate()
        text = (out or b"").decode("utf-8", errors="replace")
        models = self._parse_ollama_list(text)
        if models:
            return models
        return await self._list_models_via_http()

    async def ensure_serving(self) -> None:
        """
        Ollama Desktop often runs its server already.
        If it isn't reachable, we can attempt `ollama serve` (foreground process).

        Note: in many setups, `ollama serve` will block forever (as desired).
        """
        if await self.is_reachable():
            return

        if not self.cli_available():
            raise RuntimeError(
                "Ollama is not reachable, and the `ollama` command is not available in this environment."
            )

        # Start `ollama serve` in the background. If it fails immediately, surface logs.
        log.info("Starting `ollama serve`...")
        subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=os.environ.copy(),
        )

        # Wait a bit for it to come up
        for _ in range(10):
            if await self.is_reachable(timeout_s=1.5):
                return
            await asyncio.sleep(0.4)

        raise RuntimeError("Ollama is not reachable after starting `ollama serve`.")

    async def pull_model(self, name: str) -> list[str]:
        """
        Pull a model onto the machine where Ollama is running.

        We use the HTTP API so it works even when the `ollama` CLI isn't available (e.g. inside Docker),
        as long as the Ollama server is reachable.
        """
        logs: list[str] = []
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", f"{self._base_url}/api/pull", json={"name": name}) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    logs.append(line)
        return logs

    def _get_lan_ip(self) -> str:
        # A pragmatic way to get a LAN IP without external calls.
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
        finally:
            s.close()
        return ip

    def _parse_ollama_list(self, text: str) -> list[OllamaModel]:
        """
        Example `ollama list` output:
        NAME            ID              SIZE    MODIFIED
        llama3:latest   ...             4.7 GB  2 weeks ago
        """
        lines = [ln.strip("\n") for ln in text.splitlines() if ln.strip()]
        if len(lines) <= 1:
            return []

        # Split on 2+ spaces to keep SIZE/MODIFIED together.
        models: list[OllamaModel] = []
        for ln in lines[1:]:
            cols = re.split(r"\s{2,}", ln.strip())
            if not cols:
                continue
            name = cols[0]
            size = cols[2] if len(cols) >= 3 else None
            modified = cols[3] if len(cols) >= 4 else None
            models.append(OllamaModel(name=name, size=size, modified=modified))
        return models

    async def _list_models_via_http(self) -> list[OllamaModel]:
        """
        Fallback when the `ollama` CLI isn't available (e.g. backend running in Docker).
        """
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                r = await client.get(f"{self._base_url}/api/tags")
                r.raise_for_status()
                data = r.json()
        except Exception:
            return []

        models: list[OllamaModel] = []
        for m in data.get("models", []) or []:
            name = m.get("name")
            if not name:
                continue
            size = None
            if isinstance(m.get("size"), int):
                size = f"{m['size'] / (1024**3):.1f} GB"
            modified = m.get("modified_at") or m.get("modifiedAt")
            models.append(OllamaModel(name=name, size=size, modified=modified))
        return models

