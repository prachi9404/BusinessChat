from functools import lru_cache
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_postgres_url(url: str) -> tuple[str, dict]:
    """Convert Render/Heroku-style URLs to asyncpg SQLAlchemy URLs."""
    if url.startswith("postgres://"):
        url = f"postgresql://{url[len('postgres://'):]}"

    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    connect_args: dict = {}

    ssl_mode = (query.pop("sslmode", None) or [None])[0]
    ssl_flag = (query.pop("ssl", None) or [None])[0]
    if ssl_mode in ("require", "verify-ca", "verify-full") or ssl_flag in ("true", "1", "require"):
        connect_args["ssl"] = True

    clean_query = urlencode({key: values[0] for key, values in query.items() if values})
    clean = urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", clean_query, ""))

    if clean.startswith("postgresql://"):
        clean = clean.replace("postgresql://", "postgresql+asyncpg://", 1)

    return clean, connect_args


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "BusinessChat"
    app_env: str = "development"
    log_level: str = "info"

    api_host: str = "0.0.0.0"
    api_port: int = Field(default=8000, validation_alias=AliasChoices("PORT", "API_PORT"))

    database_url_override: str | None = Field(default=None, validation_alias="DATABASE_URL")
    redis_url_override: str | None = Field(default=None, validation_alias="REDIS_URL")

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "businesschat"
    postgres_password: str = "businesschat"
    postgres_db: str = "businesschat"

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    chat_model: str = "gpt-4o-mini"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    default_admin_password: str = "Admin123!"
    default_user_password: str = "User123!"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            url, _ = _normalize_postgres_url(self.database_url_override)
            return url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_connect_args(self) -> dict:
        if self.database_url_override:
            _, connect_args = _normalize_postgres_url(self.database_url_override)
            return connect_args
        return {}

    @property
    def redis_url(self) -> str:
        if self.redis_url_override:
            return self.redis_url_override
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
