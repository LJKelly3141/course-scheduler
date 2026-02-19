"""term_types_and_section_session

Revision ID: a4914edd247d
Revises: be74c55c7bce
Create Date: 2026-02-18 16:10:53.258726

"""
from typing import Sequence, Union
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a4914edd247d'
down_revision: Union[str, None] = 'be74c55c7bce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add session column to sections with default 'regular'
    op.execute("ALTER TABLE sections ADD COLUMN session VARCHAR(10) NOT NULL DEFAULT 'regular'")

    # 2. Convert term types: semester -> infer from name, quarter -> infer from name
    op.execute("""
        UPDATE terms SET type='fall'
        WHERE type IN ('semester','quarter') AND LOWER(name) LIKE '%fall%'
    """)
    op.execute("""
        UPDATE terms SET type='spring'
        WHERE type IN ('semester','quarter') AND LOWER(name) LIKE '%spring%'
    """)
    op.execute("""
        UPDATE terms SET type='summer'
        WHERE type IN ('semester','quarter') AND LOWER(name) LIKE '%summer%'
    """)
    op.execute("""
        UPDATE terms SET type='winter'
        WHERE type IN ('semester','quarter') AND LOWER(name) LIKE '%winter%'
    """)
    # Default remaining to 'fall'
    op.execute("""
        UPDATE terms SET type='fall'
        WHERE type IN ('semester','quarter')
    """)


def downgrade() -> None:
    # Convert term types back
    op.execute("UPDATE terms SET type='semester' WHERE type IN ('fall','spring','summer','winter')")
    # SQLite can't drop columns easily; leaving session column in place
