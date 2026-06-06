# BusinessChat

Multi-tenant AI business updates assistant. Team members post daily operational updates; the owner asks natural-language questions and gets sourced answers scoped to their company.

**Stack:** FastAPI · PostgreSQL (pgvector) · Redis · LLM (OpenAI)

## Phase 1 — Project scaffold

This phase provides:

- FastAPI application with `/` and `/health` endpoints
- Docker Compose for PostgreSQL, Redis, and the API
- Environment-based configuration (`.env.example`)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

### Quick start

```bash
# 1. Copy environment template (optional for Docker — defaults are in compose)
cp .env.example .env

# 2. Start all services
docker compose up --build

# 3. Verify
curl http://localhost:8001/health
```

Expected health response when all services are up:

```json
{
  "status": "ok",
  "app": "BusinessChat",
  "environment": "development",
  "services": {
    "postgres": { "status": "ok" },
    "redis": { "status": "ok" }
  }
}
```

### Useful URLs

| URL | Description |
|-----|-------------|
| http://localhost:8001 | API root |
| http://localhost:8001/docs | Swagger UI |
| http://localhost:8001/health | Health check (Postgres + Redis) |

### Project structure

```
BusinessChat/
├── app/
│   ├── api/health.py    # Health check endpoint
│   ├── config.py        # Settings from environment
│   └── main.py          # FastAPI entry point
├── docker-compose.yml   # Postgres + Redis + API
├── Dockerfile
├── requirements.txt
└── .env.example
```

### Development phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Scaffold, Docker, health checks |
| 2 | — | Multi-tenant data model |
| 3 | — | Message ingestion API |
| 4 | — | Embeddings & retrieval |
| 5 | — | Owner Q&A (RAG + citations) |
| 6 | — | Simple web UI |
| 7 | — | Audit trail & debug tooling |
