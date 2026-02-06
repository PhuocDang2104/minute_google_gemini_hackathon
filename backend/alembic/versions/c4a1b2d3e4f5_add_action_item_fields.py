"""Add action/decision/risk item fields

Revision ID: c4a1b2d3e4f5
Revises: e1b6c0a1d4c9
Create Date: 2026-02-06 13:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4a1b2d3e4f5'
down_revision: Union[str, None] = 'e1b6c0a1d4c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # action_item new columns
    with op.batch_alter_table('action_item') as batch:
        batch.add_column(sa.Column('project_id', sa.UUID(), nullable=True))
        batch.add_column(sa.Column('owner_user_id', sa.UUID(), nullable=True))
        batch.add_column(sa.Column('deadline', sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column('status', sa.String(), nullable=True))
        batch.add_column(sa.Column('source_chunk_id', sa.UUID(), nullable=True))
        batch.add_column(sa.Column('external_task_link', sa.Text(), nullable=True))
        batch.add_column(sa.Column('external_task_id', sa.String(), nullable=True))
        batch.add_column(sa.Column('confirmed_by', sa.UUID(), nullable=True))
        batch.add_column(sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))
        batch.create_foreign_key('fk_action_item_project', 'project', ['project_id'], ['id'])
        batch.create_foreign_key('fk_action_item_owner_user', 'user_account', ['owner_user_id'], ['id'])
        batch.create_foreign_key('fk_action_item_confirmed_by', 'user_account', ['confirmed_by'], ['id'])

    # decision_item new columns
    with op.batch_alter_table('decision_item') as batch:
        batch.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch.add_column(sa.Column('status', sa.String(), nullable=True))
        batch.add_column(sa.Column('source_chunk_id', sa.UUID(), nullable=True))
        batch.add_column(sa.Column('confirmed_by', sa.UUID(), nullable=True))
        batch.add_column(sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))
        batch.create_foreign_key('fk_decision_item_confirmed_by', 'user_account', ['confirmed_by'], ['id'])

    # risk_item new columns
    with op.batch_alter_table('risk_item') as batch:
        batch.add_column(sa.Column('owner_user_id', sa.UUID(), nullable=True))
        batch.add_column(sa.Column('status', sa.String(), nullable=True))
        batch.add_column(sa.Column('source_chunk_id', sa.UUID(), nullable=True))
        batch.create_foreign_key('fk_risk_item_owner_user', 'user_account', ['owner_user_id'], ['id'])

    # Backfill from legacy columns where possible
    op.execute("""
        UPDATE action_item
        SET deadline = due_date
        WHERE deadline IS NULL AND due_date IS NOT NULL
    """)
    op.execute("""
        UPDATE action_item
        SET status = CASE WHEN confirmed = true THEN 'confirmed' ELSE 'proposed' END
        WHERE status IS NULL
    """)
    op.execute("""
        UPDATE action_item
        SET external_task_id = external_id
        WHERE external_task_id IS NULL AND external_id IS NOT NULL
    """)
    op.execute("""
        UPDATE decision_item
        SET description = title
        WHERE description IS NULL AND title IS NOT NULL
    """)
    op.execute("""
        UPDATE decision_item
        SET status = 'proposed'
        WHERE status IS NULL
    """)
    op.execute("""
        UPDATE risk_item
        SET status = 'proposed'
        WHERE status IS NULL
    """)


def downgrade() -> None:
    with op.batch_alter_table('risk_item') as batch:
        batch.drop_constraint('fk_risk_item_owner_user', type_='foreignkey')
        batch.drop_column('source_chunk_id')
        batch.drop_column('status')
        batch.drop_column('owner_user_id')

    with op.batch_alter_table('decision_item') as batch:
        batch.drop_constraint('fk_decision_item_confirmed_by', type_='foreignkey')
        batch.drop_column('confirmed_at')
        batch.drop_column('confirmed_by')
        batch.drop_column('source_chunk_id')
        batch.drop_column('status')
        batch.drop_column('description')

    with op.batch_alter_table('action_item') as batch:
        batch.drop_constraint('fk_action_item_confirmed_by', type_='foreignkey')
        batch.drop_constraint('fk_action_item_owner_user', type_='foreignkey')
        batch.drop_constraint('fk_action_item_project', type_='foreignkey')
        batch.drop_column('confirmed_at')
        batch.drop_column('confirmed_by')
        batch.drop_column('external_task_id')
        batch.drop_column('external_task_link')
        batch.drop_column('source_chunk_id')
        batch.drop_column('status')
        batch.drop_column('deadline')
        batch.drop_column('owner_user_id')
        batch.drop_column('project_id')
