"""Add authorization workflow columns to alertas_sistema

Revision ID: 0004_auth_alerts
Revises: 0003
Create Date: 2026-06-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_auth_alerts"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"]: c for c in inspector.get_columns("alertas_sistema")}
    indexes = {i["name"] for i in inspector.get_indexes("alertas_sistema")}

    # Make id_producto nullable so authorization alerts don't need a product
    if "id_producto" in columns and not columns["id_producto"]["nullable"]:
        op.alter_column("alertas_sistema", "id_producto", nullable=True)

    # Add estado for the alert lifecycle
    if "estado" not in columns:
        op.add_column(
            "alertas_sistema",
            sa.Column(
                "estado",
                sa.String(20),
                nullable=False,
                server_default="PENDIENTE",
            ),
        )
    # JSON payload for pending authorization operations
    if "payload_json" not in columns:
        op.add_column(
            "alertas_sistema",
            sa.Column("payload_json", sa.Text(), nullable=True),
        )
    # Who created the authorization request
    if "id_usuario_solicitante" not in columns:
        op.add_column(
            "alertas_sistema",
            sa.Column(
                "id_usuario_solicitante",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("usuarios.id"),
                nullable=True,
            ),
        )
    if "ix_alertas_estado" not in indexes:
        op.create_index(
            "ix_alertas_estado",
            "alertas_sistema",
            ["estado"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"]: c for c in inspector.get_columns("alertas_sistema")}
    indexes = {i["name"] for i in inspector.get_indexes("alertas_sistema")}

    if "ix_alertas_estado" in indexes:
        op.drop_index("ix_alertas_estado", "alertas_sistema")
    if "id_usuario_solicitante" in columns:
        op.drop_column("alertas_sistema", "id_usuario_solicitante")
    if "payload_json" in columns:
        op.drop_column("alertas_sistema", "payload_json")
    if "estado" in columns:
        op.drop_column("alertas_sistema", "estado")
    if "id_producto" in columns and columns["id_producto"]["nullable"]:
        op.alter_column("alertas_sistema", "id_producto", nullable=False)
