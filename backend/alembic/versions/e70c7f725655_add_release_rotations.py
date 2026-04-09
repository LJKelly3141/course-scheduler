"""add_release_rotations

Revision ID: e70c7f725655
Revises: 91fb75a5b25b
Create Date: 2026-04-09 09:38:20.982117

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e70c7f725655'
down_revision: Union[str, None] = '91fb75a5b25b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('release_rotations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('instructor_id', sa.Integer(), sa.ForeignKey('instructors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('semester', sa.String(6), nullable=False),
        sa.Column('year_parity', sa.String(10), nullable=False, server_default='every_year'),
        sa.Column('description', sa.String(200), nullable=False),
        sa.Column('equivalent_credits', sa.Float(), nullable=False, server_default='3.0'),
        sa.Column('adjustment_type', sa.String(20), nullable=False, server_default='admin_release'),
    )


def downgrade() -> None:
    op.drop_table('release_rotations')
