from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.ask import router as ask_router
from app.api.companies import router as companies_router
from app.api.health import router as health_router
from app.api.messages import router as messages_router
from app.api.search import router as search_router
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Multi-tenant AI business updates assistant",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(companies_router)
app.include_router(messages_router)
app.include_router(search_router)
app.include_router(ask_router)

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def root() -> dict:
    return {
        "message": "BusinessChat API",
        "ui": "/app",
        "docs": "/docs",
        "health": "/health",
        "ask": "/ask",
    }


@app.get("/app")
async def web_app() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
