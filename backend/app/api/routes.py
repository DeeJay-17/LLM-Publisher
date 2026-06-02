from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from app.domain.models import PublishResponse, PullModelRequest, StatusResponse
from app.services.publisher_manager import PublisherManager


router = APIRouter(prefix="/api")


def get_publisher(request: Request) -> PublisherManager:
    return request.app.state.publisher


def get_ollama(request: Request):
    return request.app.state.ollama


def get_model_installer(request: Request):
    return request.app.state.model_installer


@router.get("/status", response_model=StatusResponse)
async def status(
    publisher: PublisherManager = Depends(get_publisher),
    ollama=Depends(get_ollama),
    model_installer=Depends(get_model_installer),
):
    health = await ollama.check_health()
    models = await ollama.list_models()
    return StatusResponse(
        ollama_reachable=health.reachable,
        ollama_network_reachable=health.network_reachable,
        ollama_base_url=ollama.base_url,
        ollama_cli_available=ollama.cli_available(),
        models=models,
        publish=publisher.snapshot(),
        model_install=model_installer.snapshot(),
    )


@router.post("/publish", response_model=PublishResponse)
async def publish(publisher: PublisherManager = Depends(get_publisher)):
    try:
        url = await publisher.publish()
        return PublishResponse(public_url=url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/stop")
async def stop(publisher: PublisherManager = Depends(get_publisher)):
    await publisher.stop()
    return {"ok": True}


@router.post("/models/pull")
async def pull_model(req: PullModelRequest, model_installer=Depends(get_model_installer)):
    try:
        res = await model_installer.start_install(req.name)
        return {"ok": True, "model": res.model}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

