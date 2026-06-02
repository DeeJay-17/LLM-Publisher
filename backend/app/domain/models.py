from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class OllamaModel(BaseModel):
    name: str
    size: Optional[str] = None
    modified: Optional[str] = None


class PublishState(BaseModel):
    status: Literal["idle", "starting", "published", "error", "stopped"] = "idle"
    public_url: Optional[str] = None
    last_error: Optional[str] = None
    logs: list[str] = Field(default_factory=list)


class ModelInstallState(BaseModel):
    status: Literal["idle", "installing", "installed", "error"] = "idle"
    model: Optional[str] = None
    last_error: Optional[str] = None
    logs: list[str] = Field(default_factory=list)


class StatusResponse(BaseModel):
    ollama_reachable: bool
    ollama_network_reachable: Optional[bool] = None
    ollama_base_url: str
    ollama_cli_available: bool
    models: list[OllamaModel]
    publish: PublishState
    model_install: ModelInstallState


class PublishResponse(BaseModel):
    public_url: str


class PullModelRequest(BaseModel):
    name: str


