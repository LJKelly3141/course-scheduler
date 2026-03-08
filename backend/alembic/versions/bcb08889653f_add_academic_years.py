"""add_academic_years

Revision ID: bcb08889653f
Revises: f64d2009e107
Create Date: 2026-03-07 10:29:51.892320

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bcb08889653f'
down_revision: Union[str, None] = 'f64d2009e107'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=:name"
    ), {"name": name})
    return result.fetchone() is not None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(f"PRAGMA table_info({table})"))
    return column in {row[1] for row in result}


def upgrade() -> None:
    if not _table_exists('academic_years'):
        op.create_table('academic_years',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=9), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('is_current', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('label')
        )
    if not _column_exists('terms', 'academic_year_id'):
        op.add_column('terms', sa.Column('academic_year_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('terms', 'academic_year_id')
    op.drop_table('academic_years')
