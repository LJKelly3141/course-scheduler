"""add_course_rotations

Revision ID: 35ff0363477a
Revises: 68f67cd15c02
Create Date: 2026-03-07 20:29:54.005126

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '35ff0363477a'
down_revision: Union[str, None] = '68f67cd15c02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('course_rotations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('course_id', sa.Integer(), nullable=False),
    sa.Column('semester', sa.Enum('fall', 'spring', 'summer', 'winter', name='rotationsemester'), nullable=False),
    sa.Column('year_parity', sa.Enum('every_year', 'even_years', 'odd_years', name='yearparity'), nullable=False),
    sa.Column('num_sections', sa.Integer(), nullable=False),
    sa.Column('enrollment_cap', sa.Integer(), nullable=False),
    sa.Column('modality', sa.String(length=20), nullable=False),
    sa.Column('notes', sa.String(length=200), nullable=True),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('course_id', 'semester', 'year_parity', name='uq_course_rotation')
    )


def downgrade() -> None:
    op.drop_table('course_rotations')
