"""add_instructor_notes

Revision ID: 27f0449992b4
Revises: 956c7a7a6990
Create Date: 2026-03-07 10:40:02.299892

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '27f0449992b4'
down_revision: Union[str, None] = '956c7a7a6990'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=:name"
    ), {"name": name})
    return result.fetchone() is not None


def upgrade() -> None:
    if not _table_exists('instructor_notes'):
        op.create_table('instructor_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('instructor_id', sa.Integer(), nullable=False),
        sa.Column('term_id', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(length=30), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['instructor_id'], ['instructors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['term_id'], ['terms.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    op.drop_table('instructor_notes')
