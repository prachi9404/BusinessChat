"""add message embedding vectors

Revision ID: 002
Revises: 001
Create Date: 2026-06-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("embedding", Vector(1536), nullable=True))
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_messages_embedding_hnsw
        ON messages USING hnsw (embedding vector_cosine_ops)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_messages_embedding_hnsw")
    op.drop_column("messages", "embedding")
