"""drop_rotation_unique_constraint

Revision ID: b0308e7208c8
Revises: e8a3b1d2f567
Create Date: 2026-04-01 19:43:32.877518

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0308e7208c8'
down_revision: Union[str, None] = 'e8a3b1d2f567'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('course_rotations') as batch_op:
        batch_op.drop_constraint('uq_course_rotation_modality', type_='unique')


def downgrade() -> None:
    with op.batch_alter_table('course_rotations') as batch_op:
        batch_op.create_unique_constraint(
            'uq_course_rotation_modality',
            ['course_id', 'semester', 'year_parity', 'modality'],
        )
