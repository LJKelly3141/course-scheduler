"""add time_block and day/time fields to course_rotations

Revision ID: e8a3b1d2f567
Revises: c4a7e2b1f389
Create Date: 2026-03-07 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e8a3b1d2f567'
down_revision: Union[str, None] = 'c4a7e2b1f389'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('course_rotations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('time_block_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('days_of_week', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('start_time', sa.Time(), nullable=True))
        batch_op.add_column(sa.Column('end_time', sa.Time(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('course_rotations', schema=None) as batch_op:
        batch_op.drop_column('end_time')
        batch_op.drop_column('start_time')
        batch_op.drop_column('days_of_week')
        batch_op.drop_column('time_block_id')
