from fastapi import APIRouter
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

router = APIRouter(tags=["health"])

settings = get_settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _check_postgres() -> dict:
    try:
        async with SessionLocal() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar_one()
        return {"status": "ok"}
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
