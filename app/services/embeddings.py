from fastapi import HTTPException, status
from openai import AsyncOpenAI

from app.config import get_settings

settings = get_settings()


def _require_api_key() -> str:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY is not configured. Add it to .env to enable embeddings.",
        )
    return settings.openai_api_key


async def embed_text(text: str) -> list[float]:
    client = AsyncOpenAI(api_key=_require_api_key())
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=text,
    )
    return response.data[0].embedding
