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
    "postgres": { "status": "ok", "counts": { "companies": 2, "users": 6, "messages": 12 } },
    "redis": { "status": "ok" }
  }
}
```

### Useful URLs

| URL | Description |
|-----|-------------|
| http://localhost:8001/app | Web UI (team updates + owner Q&A) |
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

## Phase 3 — Message ingestion API

Team members post daily updates; owners list them scoped to their company.

### Headers

| Header | Required on | Purpose |
|--------|-------------|---------|
| `X-Company-Slug` | All `/messages` routes | Tenant isolation |
| `X-User-Id` | `POST /messages` only | Identifies the author (must belong to company) |

Get user IDs from `GET /companies/me`.

### Examples

```bash
# List messages for Apex (newest first)
curl -H "X-Company-Slug: apex-manufacturing" http://localhost:8001/messages

# Post a new update
curl -X POST http://localhost:8001/messages \
  -H "X-Company-Slug: apex-manufacturing" \
  -H "X-User-Id: <user-uuid-from-companies/me>" \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"Line 3 maintenance complete.\"}"

# Filter by author or date range
curl -H "X-Company-Slug: horizon-trading" \
  "http://localhost:8001/messages?limit=10&from_date=2026-06-01T00:00:00Z"
```

### Sample seed data

12 messages are seeded (6 per company) with industry-specific vocabulary — factory lines and QC for Apex; deals and payments for Horizon.

## Phase 4 — Embeddings & semantic retrieval

Messages are converted to vectors (OpenAI embeddings) and stored in PostgreSQL (pgvector). Search always filters by `company_id` **before** ranking by similarity.

### Setup

```bash
cp .env.example .env
# Add your OpenAI key to .env:
# OPENAI_API_KEY=sk-...
docker compose up --build -d
```

On startup, any messages missing embeddings are backfilled automatically.

### Search endpoint

```bash
# Apex: factory-related query
curl -X POST http://localhost:8001/search \
  -H "X-Company-Slug: apex-manufacturing" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"how was line 2 this week?\", \"limit\": 3}"

# Horizon: same words, different company — different results
curl -X POST http://localhost:8001/search \
  -H "X-Company-Slug: horizon-trading" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"any issues with Rajan?\", \"limit\": 3}"
```

Response includes `similarity` (0–1) and matching messages as sources for Phase 5 Q&A.

### Tenant isolation in search

```
Query + X-Company-Slug
        ↓
Embed query (OpenAI)
        ↓
SQL: WHERE company_id = ? AND embedding IS NOT NULL
        ↓
ORDER BY cosine distance (top-k within company only)
```

Company B messages never enter Company A's search — even if text is similar.

### Branch strategy

Each phase is developed on its own branch:

| Branch | Phase |
|--------|-------|
| `phase-1-scaffold` | Docker + FastAPI skeleton |
| `phase-2-multi-tenant-schema` | DB schema + tenant scoping |
| `phase-3-message-ingestion` | Message POST/GET API |
| `phase-4-embeddings-retrieval` | pgvector + semantic search |
| `phase-5-owner-qa` | RAG Q&A with citations + audit log |
| `phase-6-web-ui` | Browser UI for updates + Q&A |

## Phase 6 — Web UI

A simple browser interface for demoing the full flow without Swagger.

### Open the UI

**http://localhost:8001/app**

### Features

| Panel | What you can do |
|-------|-----------------|
| **Team updates** | Switch company, pick a user, post messages, view feed |
| **Owner Q&A** | Ask questions, see AI answer + cited sources |

Use the company dropdown to switch between Apex Manufacturing and Horizon Trading.

### Development phases (updated)

| Phase | Status | Branch | Description |
|-------|--------|--------|-------------|
| 5 | ✅ | `phase-5-owner-qa` | Owner Q&A (RAG + citations) |
| 6 | ✅ | `phase-6-web-ui` | Simple web UI |

## Phase 5 — Owner Q&A (RAG + citations)

The owner asks natural-language questions. The system retrieves relevant team updates, generates an answer with GPT, and returns **cited sources**.

### Ask endpoint

```bash
curl -X POST http://localhost:8001/ask \
  -H "X-Company-Slug: apex-manufacturing" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"how was line 2 this week?\", \"limit\": 8}"
```

Response includes:
- `answer` — LLM synthesis grounded in team updates
- `sources` — message IDs + content used as evidence
- `qa_log_id` — audit record for debugging

### Debug a past answer

```bash
curl -H "X-Company-Slug: apex-manufacturing" \
  http://localhost:8001/qa/<qa_log_id>
```

Returns the stored question, answer, retrieval snapshot, and source message IDs — use this when "yesterday's answer was wrong."

### RAG flow

```
Owner question + X-Company-Slug
        ↓
Retrieve top-k messages (pgvector, tenant-scoped)
        ↓
Build prompt with sources only
        ↓
GPT answer (temperature 0.2)
        ↓
Save qa_logs row + return answer + citations
```

### Development phases

| Phase | Status | Branch | Description |
|-------|--------|--------|-------------|
| 1 | ✅ | `phase-1-scaffold` | Scaffold, Docker, health checks |
| 2 | ✅ | `phase-2-multi-tenant-schema` | Multi-tenant data model |
| 3 | ✅ | `phase-3-message-ingestion` | Message ingestion API |
| 4 | ✅ | `phase-4-embeddings-retrieval` | Embeddings & retrieval |
| 5 | ✅ | `phase-5-owner-qa` | Owner Q&A (RAG + citations) |
| 6 | ✅ | `phase-6-web-ui` | Simple web UI |
| 7 | ✅ | `phase-7-observability` | Q&A history, debug trace, submission notes |

## Phase 7 — Observability & trust

Every `/ask` call is auditable. When an answer looks wrong, inspect what was retrieved and what prompt the LLM saw.

### API

| Endpoint | Purpose |
|----------|---------|
| `GET /qa` | List past Q&A for the current company |
| `GET /qa/{id}` | Full audit record |
| `GET /qa/{id}/debug` | Adds `system_prompt`, `prompt_context`, retrieval snapshot |

### Web UI

Scroll to **Q&A history & debug** at http://localhost:8001/app — click any past question to view the debug trace.

### Submission reflections

See [SUBMISSION_NOTES.md](SUBMISSION_NOTES.md) for stack translation, LLM learnings, tenancy, and trust/debugging notes for the walkthrough call.
