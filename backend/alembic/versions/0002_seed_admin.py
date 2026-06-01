"""Seed admin user and default data

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-31
"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ADMIN_EMAIL = "admin@stocklisto.dev"


def _get_password() -> str:
    import os
    plain = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "Admin1234!")
    from argon2 import PasswordHasher
    return PasswordHasher().hash(plain)


def upgrade() -> None:
    conn = op.get_bind()

    # Idempotency guard
    existing = conn.execute(
        sa.text("SELECT id FROM usuarios WHERE email = :email"), {"email": ADMIN_EMAIL}
    ).fetchone()
    if existing:
        return

    hashed = _get_password()
    admin_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    conn.execute(
        sa.text(
            "INSERT INTO usuarios (id, nombre, email, hashed_password, rol, activo, created_at, updated_at) "
            "VALUES (:id, :nombre, :email, :pwd, 'ADMIN', true, :now, :now)"
        ),
        {"id": admin_id, "nombre": "Administrador", "email": ADMIN_EMAIL, "pwd": hashed, "now": now},
    )

    # Default categories
    for nombre in ["General", "Alimentos", "Medicamentos"]:
        conn.execute(
            sa.text(
                "INSERT INTO categorias (id, nombre, activo, created_at, updated_at) "
                "VALUES (gen_random_uuid(), :nombre, true, :now, :now) ON CONFLICT DO NOTHING"
            ),
            {"nombre": nombre, "now": now},
        )

    # Default supplier
    conn.execute(
        sa.text(
            "INSERT INTO proveedores (id, nombre, activo, created_at, updated_at) "
            "VALUES (gen_random_uuid(), 'Proveedor por defecto', true, :now, :now)"
        ),
        {"now": now},
    )

    print(f"\n✓ Admin creado: {ADMIN_EMAIL}")


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM usuarios WHERE email = :email"), {"email": ADMIN_EMAIL})
