"""flexible summer sessions

Revision ID: f64d2009e107
Revises: baa8ff8098a3
Create Date: 2026-03-06 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f64d2009e107'
down_revision: Union[str, None] = 'baa8ff8098a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Mapping from old session enum values to TermSession names
_SESSION_TO_NAME = {
    "session_a": "A",
    "session_b": "B",
    "session_c": "C",
    "session_d": "D",
}


def upgrade() -> None:
    # Widen term_sessions.name from String(1) to String(20)
    with op.batch_alter_table("term_sessions") as batch_op:
        batch_op.alter_column("name", type_=sa.String(20), existing_type=sa.String(1))

    # Add new columns to term_sessions
    op.add_column("term_sessions", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("term_sessions", sa.Column("head_count_days", sa.Integer(), nullable=True))
    op.add_column("term_sessions", sa.Column("head_count_date", sa.Date(), nullable=True))

    # Add term_session_id FK to sections
    op.add_column("sections", sa.Column("term_session_id", sa.Integer(), nullable=True))
    with op.batch_alter_table("sections") as batch_op:
        batch_op.create_foreign_key(
            "fk_sections_term_session_id",
            "term_sessions",
            ["term_session_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # Data migration: map old session enum values to term_session_id
    conn = op.get_bind()
    for enum_val, name in _SESSION_TO_NAME.items():
        conn.execute(sa.text("""
            UPDATE sections
            SET term_session_id = (
                SELECT ts.id FROM term_sessions ts
                WHERE ts.term_id = sections.term_id AND ts.name = :name
            )
            WHERE sections.session = :enum_val
              AND sections.term_session_id IS NULL
        """), {"name": name, "enum_val": enum_val})


def downgrade() -> None:
    with op.batch_alter_table("sections") as batch_op:
        batch_op.drop_constraint("fk_sections_term_session_id", type_="foreignkey")
    op.drop_column("sections", "term_session_id")
    op.drop_column("term_sessions", "head_count_date")
    op.drop_column("term_sessions", "head_count_days")
    op.drop_column("term_sessions", "end_date")
    with op.batch_alter_table("term_sessions") as batch_op:
        batch_op.alter_column("name", type_=sa.String(1), existing_type=sa.String(20))
