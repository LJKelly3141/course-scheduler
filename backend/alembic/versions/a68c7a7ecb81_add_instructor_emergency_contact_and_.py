"""add instructor emergency_contact and seasonal availability

Revision ID: a68c7a7ecb81
Revises: 33826a5657d5
Create Date: 2026-04-05 19:51:25.682320

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a68c7a7ecb81'
down_revision: Union[str, None] = '33826a5657d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('instructors', sa.Column('emergency_contact', sa.String(length=30), nullable=True))
    op.add_column('instructors', sa.Column('available_summer', sa.Boolean(), server_default='1', nullable=False))
    op.add_column('instructors', sa.Column('available_winter', sa.Boolean(), server_default='1', nullable=False))


def downgrade() -> None:
    op.drop_column('instructors', 'available_winter')
    op.drop_column('instructors', 'available_summer')
    op.drop_column('instructors', 'emergency_contact')
