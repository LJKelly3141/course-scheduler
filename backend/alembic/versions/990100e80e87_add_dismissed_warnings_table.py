"""add dismissed_warnings table

Revision ID: 990100e80e87
Revises: 3a7197681912
Create Date: 2026-02-18 11:49:44.086038

"""
from typing import Sequence, Union
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '990100e80e87'
down_revision: Union[str, None] = '3a7197681912'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS dismissed_warnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
            warning_key VARCHAR(255) NOT NULL
        )
    """)


def downgrade() -> None:
    op.drop_table('dismissed_warnings')
