from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse
from starlette.staticfiles import StaticFiles

from app.api.ask import router as ask_router
from app.api.auth import router as auth_router
from app.api.companies import router as companies_router
from app.api.users import router as users_router
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
app.include_router(auth_router)
app.include_router(companies_router)
app.include_router(users_router)
app.include_router(messages_router)
app.include_router(search_router)
app.include_router(ask_router)

STATIC_DIR = Path(__file__).parent / "static"

NO_CACHE = "no-cache, no-store, must-revalidate"


class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = NO_CACHE
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


app.mount("/static", NoCacheStaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def root() -> RedirectResponse:
    return RedirectResponse(url="/login", status_code=302)


@app.get("/login")
async def login_page() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "login.html",
        headers={
            "Cache-Control": NO_CACHE,
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/app")
async def web_app() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "index.html",
        headers={
            "Cache-Control": NO_CACHE,
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
