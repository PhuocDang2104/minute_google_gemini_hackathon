"""Add meeting recording table

Revision ID: 9f2c4b1d7a1a
Revises: 7f2a3d9c1b52
Create Date: 2026-02-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f2c4b1d7a1a'
down_revision: Union[str, None] = '7f2a3d9c1b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'meeting_recording',
        sa.Column('meeting_id', sa.UUID(), nullable=False),
        sa.Column('file_url', sa.Text(), nullable=True),
        sa.Column('storage_key', sa.String(), nullable=True),
        sa.Column('provider', sa.String(), nullable=True),
        sa.Column('original_filename', sa.String(), nullable=True),
        sa.Column('content_type', sa.String(), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('duration_sec', sa.Float(), nullable=True),
        sa.Column('uploaded_by', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['meeting_id'], ['meeting.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['user_account.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_meeting_recording_meeting_id'), 'meeting_recording', ['meeting_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_meeting_recording_meeting_id'), table_name='meeting_recording')
    op.drop_table('meeting_recording')
