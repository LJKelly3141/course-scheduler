"""add_section_lecture_hours_fee_notes

Revision ID: baa8ff8098a3
Revises: a1b2c3d4e5f6
Create Date: 2026-03-06 21:36:25.406080

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'baa8ff8098a3'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sections', sa.Column('lecture_hours', sa.Float(), nullable=True))
    op.add_column('sections', sa.Column('special_course_fee', sa.Float(), nullable=True))
    op.add_column('sections', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('sections', 'notes')
    op.drop_column('sections', 'special_course_fee')
    op.drop_column('sections', 'lecture_hours')
