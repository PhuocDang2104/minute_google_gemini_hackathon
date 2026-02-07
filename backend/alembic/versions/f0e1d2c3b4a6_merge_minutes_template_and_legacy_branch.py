"""Merge minutes-template branch and legacy bridge branch

Revision ID: f0e1d2c3b4a6
Revises: e7f1c2d3b4a5, a1d4f6b9c2e7
Create Date: 2026-02-07 23:56:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "f0e1d2c3b4a6"
down_revision: Union[str, Sequence[str], None] = ("e7f1c2d3b4a5", "a1d4f6b9c2e7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
