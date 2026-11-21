"""Add explicit public roadmap publications.

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-21

Public publication identifiers are separate from invite tokens. Unpublishing
replaces the public identifier so a previously shared link cannot be revived
by publishing again.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roadmap_publications",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("roadmap_id", sa.String(), nullable=False),
        sa.Column("public_id", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unpublished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('published', 'unpublished')",
            name="ck_roadmap_publications_status",
        ),
        sa.ForeignKeyConstraint(["roadmap_id"], ["roadmaps.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_roadmap_publications_public_id"),
        sa.UniqueConstraint("roadmap_id", name="uq_roadmap_publications_roadmap"),
    )


def downgrade() -> None:
    op.drop_table("roadmap_publications")
