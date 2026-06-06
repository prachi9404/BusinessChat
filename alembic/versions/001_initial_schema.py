"""initial multi-tenant schema

Revision ID: 001
Revises:
Create Date: 2026-06-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

user_role = postgresql.ENUM("owner", "member", name="user_role", create_type=False)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE user_role AS ENUM ('owner', 'member');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "companies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("industry", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_companies_slug"), "companies", ["slug"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),  # type: ignore[arg-type]
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "email", name="uq_users_company_email"),
    )
    op.create_index(op.f("ix_users_company_id"), "users", ["company_id"], unique=False)

    op.create_table(
        "messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_messages_company_id"), "messages", ["company_id"], unique=False)
    op.create_index(op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False)
    op.create_index(op.f("ix_messages_user_id"), "messages", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_messages_user_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_created_at"), table_name="messages")
    op.drop_index(op.f("ix_messages_company_id"), table_name="messages")
    op.drop_table("messages")
    op.drop_index(op.f("ix_users_company_id"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_companies_slug"), table_name="companies")
    op.drop_table("companies")
    op.execute("DROP TYPE IF EXISTS user_role")
