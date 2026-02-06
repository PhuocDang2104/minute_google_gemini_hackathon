"""Add ask_ai_query table

Revision ID: f1a9b7c3d2e1
Revises: c4a1b2d3e4f5
Create Date: 2026-02-06 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a9b7c3d2e1'
down_revision: Union[str, None] = 'c4a1b2d3e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ask_ai_query',
        sa.Column('meeting_id', sa.UUID(), nullable=True),
        sa.Column('query_text', sa.Text(), nullable=False),
        sa.Column('answer_text', sa.Text(), nullable=False),
        sa.Column('citations', sa.JSON(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['meeting_id'], ['meeting.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ask_ai_query_meeting_id'), 'ask_ai_query', ['meeting_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ask_ai_query_meeting_id'), table_name='ask_ai_query')
    op.drop_table('ask_ai_query')
