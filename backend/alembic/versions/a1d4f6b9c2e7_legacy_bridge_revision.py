"""Legacy bridge revision (compatibility placeholder)

Revision ID: a1d4f6b9c2e7
Revises: d9e8f7a6b5c4
Create Date: 2026-02-07 23:55:00.000000

This revision exists only to bridge legacy databases that were previously
stamped with `a1d4f6b9c2e7` but no longer had the migration file in repo.
It is intentionally a no-op.
"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "a1d4f6b9c2e7"
down_revision: Union[str, Sequence[str], None] = "d9e8f7a6b5c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
