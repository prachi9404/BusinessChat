#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Seeding database (if empty)..."
python -m app.db.seed

echo "Backfilling embeddings for messages without vectors..."
python -m app.db.backfill_embeddings

echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
