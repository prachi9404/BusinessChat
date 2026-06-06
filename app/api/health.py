from fastapi import APIRouter
from redis.asyncio import Redis
from sqlalchemy import func, select, text

from app.config import get_settings
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.message import Message
from app.models.user import User

router = APIRouter(tags=["health"])
settings = get_settings()


async def _check_postgres() -> dict:
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
            companies = await session.scalar(select(func.count()).select_from(Company))
            users = await session.scalar(select(func.count()).select_from(User))
            messages = await session.scalar(select(func.count()).select_from(Message))
        return {
            "status": "ok",
            "counts": {
                "companies": companies,
                "users": users,
                "messages": messages,
            },
        }
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


async def _check_redis() -> dict:
    client = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        pong = await client.ping()
        if pong:
            return {"status": "ok"}
        return {"status": "error", "detail": "Redis ping returned false"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
    finally:
        await client.aclose()


@router.get("/health")
async def health_check() -> dict:
    postgres = await _check_postgres()
    redis = await _check_redis()

    overall = "ok" if postgres["status"] == "ok" and redis["status"] == "ok" else "degraded"

    return {
        "status": overall,
        "app": settings.app_name,
        "environment": settings.app_env,
        "services": {
            "postgres": postgres,
            "redis": redis,
        },
    }
