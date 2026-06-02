from __future__ import annotations

import asyncio
import logging
import re
from collections import deque
from dataclasses import dataclass
from typing import Deque, Optional


log = logging.getLogger(__name__)


TRY_CLOUDFLARE_RE = re.compile(r"(https://[a-z0-9-]+\.trycloudflare\.com)\b", re.IGNORECASE)


@dataclass
class TunnelResult:
    public_url: str


class CloudflaredService:
    """
    Starts a Cloudflare *quick tunnel* and extracts the public URL from output.
    """

    def __init__(self, max_logs: int = 500) -> None:
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._logs: Deque[str] = deque(maxlen=max_logs)
        self._public_url: Optional[str] = None
        self._reader_task: Optional[asyncio.Task[None]] = None

    @property
    def public_url(self) -> Optional[str]:
        return self._public_url

    def logs(self) -> list[str]:
        return list(self._logs)

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.returncode is None

    async def start_quick_tunnel(self, url: str, timeout_s: float = 25.0) -> TunnelResult:
        if self.is_running():
            if self._public_url:
                return TunnelResult(public_url=self._public_url)
            raise RuntimeError("Tunnel is already starting but URL is not available yet.")

        self._public_url = None
        self._logs.clear()

        self._proc = await asyncio.create_subprocess_exec(
            "cloudflared",
            "tunnel",
            "--url",
            url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        assert self._proc.stdout is not None
        self._reader_task = asyncio.create_task(self._read_output(self._proc.stdout))

        try:
            await asyncio.wait_for(self._wait_for_url(), timeout=timeout_s)
        except TimeoutError as e:
            await self.stop()
            raise RuntimeError("Timed out waiting for Cloudflare public URL.") from e

        if not self._public_url:
            await self.stop()
            raise RuntimeError("Failed to extract Cloudflare public URL from output.")

        return TunnelResult(public_url=self._public_url)

    async def stop(self) -> None:
        if not self._proc:
            return

        proc = self._proc
        self._proc = None

        if proc.returncode is None:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=5.0)
            except TimeoutError:
                proc.kill()
                await proc.wait()

        if self._reader_task:
            self._reader_task.cancel()
            self._reader_task = None

    async def _wait_for_url(self) -> None:
        while self.is_running() and not self._public_url:
            await asyncio.sleep(0.05)

    async def _read_output(self, stream: asyncio.StreamReader) -> None:
        while True:
            line = await stream.readline()
            if not line:
                return
            text = line.decode("utf-8", errors="replace").rstrip("\n")
            self._logs.append(text)

            found = self.extract_public_url(text)
            if found and not self._public_url:
                self._public_url = found
                log.info("Cloudflare public URL: %s", found)

    @staticmethod
    def extract_public_url(text_blob: str) -> Optional[str]:
        """
        Elegant extraction:
        - Works line-by-line or on full blobs
        - Handles the boxed output line, and any other log lines containing the URL
        - Only accepts `trycloudflare.com` quick tunnel URLs (free, account-less)
        """
        m = TRY_CLOUDFLARE_RE.search(text_blob)
        if not m:
            return None
        return m.group(1)

