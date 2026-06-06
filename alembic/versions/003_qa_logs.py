"""add qa audit logs

Revision ID: 003
Revises: 002
Create Date: 2026-06-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "qa_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("source_message_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("retrieval_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("model_used", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_qa_logs_company_id"), "qa_logs", ["company_id"], unique=False)
    op.create_index(op.f("ix_qa_logs_created_at"), "qa_logs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_qa_logs_created_at"), table_name="qa_logs")
    op.drop_index(op.f("ix_qa_logs_company_id"), table_name="qa_logs")
    op.drop_table("qa_logs")
