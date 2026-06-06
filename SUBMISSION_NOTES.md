# Submission Notes

Short reflections for the architecture walkthrough call.

## 1. Stack translation (Spring Boot → FastAPI)

Coming from Spring Boot, my instinct was to reach for layered packages (controller/service/repository), interface-driven DI, and eventually separate services per domain. I kept the **layering and tenant boundaries** but deliberately stayed in a **single deployable FastAPI app** with SQLAlchemy + Alembic instead of spinning up microservices. Docker Compose replaced Eureka/Config Server for local orchestration. The biggest instinct I left behind was **over-abstracting early** — e.g. no repository interfaces, no event bus, no separate embedding service — because the assignment rewards a working end-to-end loop in a weekend, not enterprise scaffolding.

## 2. First LLM project

**Easier than expected:** wiring OpenAI embeddings + chat behind a small service layer; using pgvector for retrieval; getting multi-tenant scoping with a header + `company_id` on every query.

**Harder than expected:** judging answer quality (e.g. calling a payment-term change an "issue"); tuning retrieval so unrelated-but-similar messages appear in sources; handling env/config correctly in Docker on Windows.

**Cautious about shipping to real customers:** ungrounded or over-confident LLM phrasing; retrieval leakage if tenant filters are missed anywhere; cost/latency at scale; PII in prompts; no human feedback loop or evaluation suite yet.

## 3. Two-company question

Isolation is enforced at three levels: (1) `X-Company-Slug` resolves the tenant on every API call, (2) all SQL and vector queries include `WHERE company_id = ?`, (3) Redis keys and future caches would be prefixed by company. If Company A asks about "Rajan" and Company B also has Rajan updates, **similarity search still cannot return B's rows** because the vector query is scoped to A's `company_id` first. Defense in depth: wrong slug → 404; cross-tenant UUID access → 404.

## 4. Trust — "the answer was wrong yesterday"

**How to find out why:** look up `qa_log_id` from the answer (or `GET /qa` history) → open `GET /qa/{id}/debug` to see the stored question, answer, `retrieval_snapshot` (messages + similarity scores), and `prompt_context` sent to the model. Re-run `POST /search` with the same question to see if retrieval changed. Compare cited `source_message_ids` to current message rows.

**Built for debugging:** `qa_logs` table on every `/ask`; retrieval snapshot JSON; prompt context storage (Phase 7); per-answer source list in API + UI; audit ID shown to the owner in the web UI.
