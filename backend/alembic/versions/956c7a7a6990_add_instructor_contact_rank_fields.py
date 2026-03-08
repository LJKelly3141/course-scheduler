"""add_instructor_contact_rank_fields

Revision ID: 956c7a7a6990
Revises: bcb08889653f
Create Date: 2026-03-07 10:36:11.147924

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '956c7a7a6990'
down_revision: Union[str, None] = 'bcb08889653f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(f"PRAGMA table_info({table})"))
    return column in {row[1] for row in result}


_COLUMNS = [
    ('first_name', sa.String(length=50)),
    ('last_name', sa.String(length=50)),
    ('phone', sa.String(length=30)),
    ('office_location', sa.String(length=100)),
    ('rank', sa.String(length=30)),
    ('tenure_status', sa.String(length=20)),
    ('hire_date', sa.Date()),
]


def upgrade() -> None:
    for col_name, col_type in _COLUMNS:
        if not _column_exists('instructors', col_name):
            op.add_column('instructors', sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    for col_name, _ in reversed(_COLUMNS):
        op.drop_column('instructors', col_name)
