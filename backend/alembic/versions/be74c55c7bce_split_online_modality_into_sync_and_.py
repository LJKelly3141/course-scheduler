"""split online modality into sync and async

Revision ID: be74c55c7bce
Revises: 990100e80e87
Create Date: 2026-02-18 13:41:10.250350

"""
from typing import Sequence, Union
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'be74c55c7bce'
down_revision: Union[str, None] = '990100e80e87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Sections with modality='online' that have meetings with time data → online_sync
    op.execute("""
        UPDATE sections SET modality='online_sync'
        WHERE modality='online'
          AND id IN (SELECT DISTINCT section_id FROM meetings WHERE start_time IS NOT NULL)
    """)
    # Remaining online sections (no meetings) → online_async
    op.execute("""
        UPDATE sections SET modality='online_async'
        WHERE modality='online'
    """)


def downgrade() -> None:
    op.execute("UPDATE sections SET modality='online' WHERE modality IN ('online_sync', 'online_async')")
