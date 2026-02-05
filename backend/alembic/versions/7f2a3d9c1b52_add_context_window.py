"""Add context window table

Revision ID: 7f2a3d9c1b52
Revises: b60280499543
Create Date: 2026-02-05 09:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f2a3d9c1b52'
down_revision: Union[str, None] = 'b60280499543'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'context_window',
        sa.Column('meeting_id', sa.UUID(), nullable=False),
        sa.Column('start_time', sa.Float(), nullable=False),
        sa.Column('end_time', sa.Float(), nullable=False),
        sa.Column('transcript_text', sa.Text(), nullable=True),
        sa.Column('visual_context', sa.JSON(), nullable=True),
        sa.Column('citations', sa.JSON(), nullable=True),
        sa.Column('window_index', sa.Integer(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['meeting_id'], ['meeting.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('context_window')
