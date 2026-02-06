"""Add meeting minutes tables

Revision ID: e1b6c0a1d4c9
Revises: 9f2c4b1d7a1a
Create Date: 2026-02-06 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1b6c0a1d4c9'
down_revision: Union[str, None] = '9f2c4b1d7a1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'meeting_minutes',
        sa.Column('meeting_id', sa.UUID(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('minutes_text', sa.Text(), nullable=True),
        sa.Column('minutes_html', sa.Text(), nullable=True),
        sa.Column('minutes_markdown', sa.Text(), nullable=True),
        sa.Column('minutes_doc_url', sa.Text(), nullable=True),
        sa.Column('executive_summary', sa.Text(), nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('edited_by', sa.UUID(), nullable=True),
        sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['meeting_id'], ['meeting.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['edited_by'], ['user_account.id'], ),
        sa.ForeignKeyConstraint(['approved_by'], ['user_account.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_meeting_minutes_meeting_id'), 'meeting_minutes', ['meeting_id'], unique=False)

    op.create_table(
        'minutes_distribution_log',
        sa.Column('minutes_id', sa.UUID(), nullable=False),
        sa.Column('meeting_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('channel', sa.String(), nullable=False),
        sa.Column('recipient_email', sa.String(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['meeting_id'], ['meeting.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['minutes_id'], ['meeting_minutes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['user_account.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_minutes_distribution_log_meeting_id'), 'minutes_distribution_log', ['meeting_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_minutes_distribution_log_meeting_id'), table_name='minutes_distribution_log')
    op.drop_table('minutes_distribution_log')
    op.drop_index(op.f('ix_meeting_minutes_meeting_id'), table_name='meeting_minutes')
    op.drop_table('meeting_minutes')
