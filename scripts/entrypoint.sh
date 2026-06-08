#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Seeding database (if empty)..."
python -m app.db.seed

echo "Backfilling embeddings for messages without vectors..."
python -m app.db.backfill_embeddings

PORT="${PORT:-8000}"
RELOAD_FLAG=""

if [ "$APP_ENV" != "production" ]; then
  RELOAD_FLAG="--reload"
fi

echo "Starting API server on port ${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" ${RELOAD_FLAG}
