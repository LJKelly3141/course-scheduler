"""add instruction_type to sections

Revision ID: 33826a5657d5
Revises: b0308e7208c8
Create Date: 2026-04-04 08:10:19.806353

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33826a5657d5'
down_revision: Union[str, None] = 'b0308e7208c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sections', sa.Column('instruction_type', sa.Enum('LEC', 'LAB', 'FLD', name='instructiontype'), nullable=True))


def downgrade() -> None:
    op.drop_column('sections', 'instruction_type')
