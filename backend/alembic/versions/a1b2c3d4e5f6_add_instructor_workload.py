"""add instructor workload

Revision ID: a1b2c3d4e5f6
Revises: bd35774985a2
Create Date: 2026-03-06 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'bd35774985a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('instructors', sa.Column('instructor_type', sa.String(length=20), nullable=True))
    op.add_column('sections', sa.Column('equivalent_credits', sa.Integer(), nullable=True))
    op.create_table('load_adjustments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('instructor_id', sa.Integer(), nullable=False),
        sa.Column('term_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(length=200), nullable=False),
        sa.Column('equivalent_credits', sa.Float(), nullable=False, server_default='0'),
        sa.Column('adjustment_type', sa.Enum('research_release', 'admin_release', 'course_release', 'adhoc', 'overload', 'other', name='adjustmenttype'), nullable=False),
        sa.ForeignKeyConstraint(['instructor_id'], ['instructors.id']),
        sa.ForeignKeyConstraint(['term_id'], ['terms.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('load_adjustments')
    op.drop_column('sections', 'equivalent_credits')
    op.drop_column('instructors', 'instructor_type')
