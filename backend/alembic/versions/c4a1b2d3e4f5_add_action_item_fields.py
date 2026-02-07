"""Add action/decision/risk item fields

Revision ID: c4a1b2d3e4f5
Revises: e1b6c0a1d4c9
Create Date: 2026-02-06 13:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


def _get_columns(inspector: sa.inspect, table: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table)}


def _get_fk_names(inspector: sa.inspect, table: str) -> set[str]:
    return {fk.get("name") for fk in inspector.get_foreign_keys(table) if fk.get("name")}


# revision identifiers, used by Alembic.
revision: str = 'c4a1b2d3e4f5'
down_revision: Union[str, None] = 'e1b6c0a1d4c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # action_item new columns
    action_cols = _get_columns(inspector, "action_item")
    action_fks = _get_fk_names(inspector, "action_item")
    with op.batch_alter_table('action_item') as batch:
        if "project_id" not in action_cols:
            batch.add_column(sa.Column('project_id', sa.UUID(), nullable=True))
            action_cols.add("project_id")
        if "owner_user_id" not in action_cols:
            batch.add_column(sa.Column('owner_user_id', sa.UUID(), nullable=True))
            action_cols.add("owner_user_id")
        if "deadline" not in action_cols:
            batch.add_column(sa.Column('deadline', sa.DateTime(timezone=True), nullable=True))
            action_cols.add("deadline")
        if "status" not in action_cols:
            batch.add_column(sa.Column('status', sa.String(), nullable=True))
            action_cols.add("status")
        if "source_chunk_id" not in action_cols:
            batch.add_column(sa.Column('source_chunk_id', sa.UUID(), nullable=True))
            action_cols.add("source_chunk_id")
        if "external_task_link" not in action_cols:
            batch.add_column(sa.Column('external_task_link', sa.Text(), nullable=True))
            action_cols.add("external_task_link")
        if "external_task_id" not in action_cols:
            batch.add_column(sa.Column('external_task_id', sa.String(), nullable=True))
            action_cols.add("external_task_id")
        if "confirmed_by" not in action_cols:
            batch.add_column(sa.Column('confirmed_by', sa.UUID(), nullable=True))
            action_cols.add("confirmed_by")
        if "confirmed_at" not in action_cols:
            batch.add_column(sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))
            action_cols.add("confirmed_at")
        if "project_id" in action_cols and "fk_action_item_project" not in action_fks:
            batch.create_foreign_key('fk_action_item_project', 'project', ['project_id'], ['id'])
        if "owner_user_id" in action_cols and "fk_action_item_owner_user" not in action_fks:
            batch.create_foreign_key('fk_action_item_owner_user', 'user_account', ['owner_user_id'], ['id'])
        if "confirmed_by" in action_cols and "fk_action_item_confirmed_by" not in action_fks:
            batch.create_foreign_key('fk_action_item_confirmed_by', 'user_account', ['confirmed_by'], ['id'])

    # decision_item new columns
    decision_cols = _get_columns(inspector, "decision_item")
    decision_fks = _get_fk_names(inspector, "decision_item")
    with op.batch_alter_table('decision_item') as batch:
        if "description" not in decision_cols:
            batch.add_column(sa.Column('description', sa.Text(), nullable=True))
            decision_cols.add("description")
        if "status" not in decision_cols:
            batch.add_column(sa.Column('status', sa.String(), nullable=True))
            decision_cols.add("status")
        if "source_chunk_id" not in decision_cols:
            batch.add_column(sa.Column('source_chunk_id', sa.UUID(), nullable=True))
            decision_cols.add("source_chunk_id")
        if "confirmed_by" not in decision_cols:
            batch.add_column(sa.Column('confirmed_by', sa.UUID(), nullable=True))
            decision_cols.add("confirmed_by")
        if "confirmed_at" not in decision_cols:
            batch.add_column(sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))
            decision_cols.add("confirmed_at")
        if "confirmed_by" in decision_cols and "fk_decision_item_confirmed_by" not in decision_fks:
            batch.create_foreign_key('fk_decision_item_confirmed_by', 'user_account', ['confirmed_by'], ['id'])

    # risk_item new columns
    risk_cols = _get_columns(inspector, "risk_item")
    risk_fks = _get_fk_names(inspector, "risk_item")
    with op.batch_alter_table('risk_item') as batch:
        if "owner_user_id" not in risk_cols:
            batch.add_column(sa.Column('owner_user_id', sa.UUID(), nullable=True))
            risk_cols.add("owner_user_id")
        if "status" not in risk_cols:
            batch.add_column(sa.Column('status', sa.String(), nullable=True))
            risk_cols.add("status")
        if "source_chunk_id" not in risk_cols:
            batch.add_column(sa.Column('source_chunk_id', sa.UUID(), nullable=True))
            risk_cols.add("source_chunk_id")
        if "owner_user_id" in risk_cols and "fk_risk_item_owner_user" not in risk_fks:
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
