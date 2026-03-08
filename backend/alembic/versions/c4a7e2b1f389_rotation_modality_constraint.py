"""update rotation unique constraint to include modality

Revision ID: c4a7e2b1f389
Revises: 35ff0363477a
Create Date: 2026-03-07 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4a7e2b1f389'
down_revision: Union[str, None] = '35ff0363477a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite requires batch mode to alter constraints
    with op.batch_alter_table('course_rotations', schema=None) as batch_op:
        batch_op.drop_constraint('uq_course_rotation', type_='unique')
        batch_op.create_unique_constraint(
            'uq_course_rotation_modality',
            ['course_id', 'semester', 'year_parity', 'modality']
        )


def downgrade() -> None:
    with op.batch_alter_table('course_rotations', schema=None) as batch_op:
        batch_op.drop_constraint('uq_course_rotation_modality', type_='unique')
        batch_op.create_unique_constraint(
            'uq_course_rotation',
            ['course_id', 'semester', 'year_parity']
        )
