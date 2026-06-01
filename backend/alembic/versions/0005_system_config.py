"""Add configuracion_sistema singleton table

Revision ID: 0005_system_config
Revises: 0004_auth_alerts
Create Date: 2026-06-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_system_config"
down_revision: Union[str, None] = "0004_auth_alerts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "configuracion_sistema",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("alertas_stock_activas", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("alertas_vencimiento_activas", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("alertas_ingreso_pendiente", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("alertas_despacho_pendiente", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("dias_anticipacion_vencimiento", sa.Integer, nullable=False, server_default="30"),
        sa.Column("requerir_auth_ingreso_operador", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("requerir_auth_despacho", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("despacho_auth_umbral_unidades", sa.Integer, nullable=False, server_default="500"),
        sa.Column(
            "despacho_auth_umbral_monto",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="10000.00",
        ),
    )
    op.execute("INSERT INTO configuracion_sistema (id) VALUES (1)")


def downgrade() -> None:
    op.drop_table("configuracion_sistema")
