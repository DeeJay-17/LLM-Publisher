from __future__ import annotations

import os

from pydantic import BaseModel


class Settings(BaseModel):
    """
    Runtime settings.

    Docker on macOS typically needs host access via host.docker.internal.
    """

    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    allow_start_ollama_serve: bool = os.environ.get("ALLOW_START_OLLAMA_SERVE", "true").lower() in (
        "1",
        "true",
        "yes",
        "y",
        "on",
    )
    static_dir: str = os.environ.get("STATIC_DIR", "static")

