"""Update seeded admin email to valid domain

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_ADMIN_EMAIL = "admin@stocklisto.local"
NEW_ADMIN_EMAIL = "admin@stocklisto.dev"


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE usuarios SET email = :new_email WHERE email = :old_email"),
        {"new_email": NEW_ADMIN_EMAIL, "old_email": OLD_ADMIN_EMAIL},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE usuarios SET email = :old_email WHERE email = :new_email"),
        {"new_email": NEW_ADMIN_EMAIL, "old_email": OLD_ADMIN_EMAIL},
    )
