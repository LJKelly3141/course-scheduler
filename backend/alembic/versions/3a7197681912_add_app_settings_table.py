"""add app_settings table

Revision ID: 3a7197681912
Revises: a06a39524b91
Create Date: 2026-02-17 19:55:42.915572

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a7197681912'
down_revision: Union[str, None] = 'a06a39524b91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            "key" VARCHAR(100) NOT NULL PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        )
    """)


def downgrade() -> None:
    op.drop_table('app_settings')
