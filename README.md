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
    "postgres": { "status": "ok", "counts": { "companies": 2, "users": 6, "messages": 0 } },
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

## Phase 2 — Multi-tenant data model

On startup the API automatically runs migrations and seeds two demo companies:

| Slug | Company | Industry |
|------|---------|----------|
| `apex-manufacturing` | Apex Manufacturing | Factory lines, downtime, shipments |
| `horizon-trading` | Horizon Trading Co. | Deals, payments, commodities |

Each company has an **owner** and two **members**.

### Tenant scoping

Tenant-scoped endpoints require the `X-Company-Slug` header:

```bash
# List all companies (no tenant header)
curl http://localhost:8001/companies

# Get current company + team (tenant header required)
curl -H "X-Company-Slug: apex-manufacturing" http://localhost:8001/companies/me
```

### Schema

```
companies ──┬── users
            └── messages (company_id on every row)
```

Every tenant-owned table includes `company_id` so queries never mix data across companies.

### Project structure

```
BusinessChat/
├── alembic/               # Database migrations
├── app/
│   ├── api/               # Route handlers
│   ├── db/                # Session, seed script
│   ├── dependencies/      # Tenant resolution (X-Company-Slug)
│   ├── models/            # SQLAlchemy models
│   └── schemas/           # Pydantic response models
├── scripts/entrypoint.sh  # migrate → seed → start
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

### Development phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Scaffold, Docker, health checks |
| 2 | ✅ | Multi-tenant data model |
| 3 | — | Message ingestion API |
| 4 | — | Embeddings & retrieval |
| 5 | — | Owner Q&A (RAG + citations) |
| 6 | — | Simple web UI |
| 7 | — | Audit trail & debug tooling |
