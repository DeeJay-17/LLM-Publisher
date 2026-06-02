from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.core.config import Settings
from app.core.logging import configure_logging
from app.services.cloudflared_service import CloudflaredService
from app.services.model_installer import ModelInstaller
from app.services.ollama_service import OllamaService
from app.services.publisher_manager import PublisherManager


def create_app() -> FastAPI:
    configure_logging()
    settings = Settings()

    app = FastAPI(title="LLM Publisher", version="0.1.0")

    app.state.settings = settings
    app.state.ollama = OllamaService(settings.ollama_base_url)
    app.state.cloudflared = CloudflaredService()
    app.state.publisher = PublisherManager(
        app.state.ollama,
        app.state.cloudflared,
        allow_start_ollama_serve=settings.allow_start_ollama_serve,
    )
    app.state.model_installer = ModelInstaller(app.state.ollama)

    app.include_router(api_router)

    static_dir = Path(__file__).resolve().parent.parent / settings.static_dir
    # In Docker we copy the built frontend to backend/static/.
    if static_dir.exists():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

        @app.get("/{full_path:path}")
        async def spa_fallback(full_path: str):
            # Let the static mount handle real files; for client routes, serve index.html.
            index = static_dir / "index.html"
            if index.exists():
                return FileResponse(str(index))
            return {"error": "Frontend not built"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)

