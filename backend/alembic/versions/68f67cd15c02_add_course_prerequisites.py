"""add_course_prerequisites

Revision ID: 68f67cd15c02
Revises: 27f0449992b4
Create Date: 2026-03-07 19:45:13.726277

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68f67cd15c02'
down_revision: Union[str, None] = '27f0449992b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('course_prerequisites',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('course_id', sa.Integer(), nullable=False),
    sa.Column('prerequisite_id', sa.Integer(), nullable=False),
    sa.Column('is_corequisite', sa.Boolean(), nullable=False),
    sa.Column('notes', sa.String(length=200), nullable=True),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['prerequisite_id'], ['courses.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('course_id', 'prerequisite_id', name='uq_course_prereq')
    )


def downgrade() -> None:
    op.drop_table('course_prerequisites')
