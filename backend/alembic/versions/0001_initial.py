"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-31
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extensions (pg_trgm already enabled via init.sql)
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    # usuarios
    op.create_table(
        "usuarios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("rol", sa.String(20), nullable=False, server_default="OPERATOR"),
        sa.Column("activo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_usuarios_email", "usuarios", ["email"], unique=True)

    # refresh_tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jti_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_refresh_tokens_usuario_id", "refresh_tokens", ["usuario_id"])

    # categorias
    op.create_table(
        "categorias",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("nombre", sa.String(100), unique=True, nullable=False),
        sa.Column("descripcion", sa.String(255)),
        sa.Column("activo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # proveedores
    op.create_table(
        "proveedores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("nombre", sa.String(150), nullable=False),
        sa.Column("contacto", sa.String(150)),
        sa.Column("telefono", sa.String(30)),
        sa.Column("email", sa.String(255)),
        sa.Column("activo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # productos
    op.create_table(
        "productos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("codigo", sa.String(60), unique=True, nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.String(500)),
        sa.Column("unidad_base", sa.String(30), nullable=False, server_default="unidad"),
        sa.Column("stock_minimo", sa.Integer, nullable=False, server_default="0"),
        sa.Column("stock_actual", sa.Integer, nullable=False, server_default="0"),
        sa.Column("costo_promedio_ponderado", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("id_categoria", UUID(as_uuid=True), sa.ForeignKey("categorias.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_productos_codigo", "productos", ["codigo"], unique=True)
    op.execute("CREATE INDEX ix_productos_nombre_trgm ON productos USING GIN (nombre gin_trgm_ops)")

    # lotes
    op.create_table(
        "lotes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("id_producto", UUID(as_uuid=True), sa.ForeignKey("productos.id"), nullable=False),
        sa.Column("id_proveedor", UUID(as_uuid=True), sa.ForeignKey("proveedores.id"), nullable=True),
        sa.Column("numero_factura", sa.String(60)),
        sa.Column("cantidad_inicial", sa.Integer, nullable=False),
        sa.Column("cantidad_actual", sa.Integer, nullable=False),
        sa.Column("unidades_por_caja", sa.Integer, nullable=False, server_default="1"),
        sa.Column("costo_total", sa.Numeric(14, 4), nullable=False),
        sa.Column("costo_unitario", sa.Numeric(14, 4), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date),
        sa.Column("descripcion", sa.String(255)),
        sa.Column("activo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("fecha_ingreso", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("cantidad_actual >= 0", name="ck_lote_cantidad_actual_positive"),
        sa.CheckConstraint("cantidad_actual <= cantidad_inicial", name="ck_lote_cantidad_no_excede"),
        sa.CheckConstraint("cantidad_inicial > 0", name="ck_lote_cantidad_inicial_positive"),
    )
    op.create_index("ix_lotes_id_producto", "lotes", ["id_producto"])
    op.execute(
        "CREATE INDEX ix_lotes_producto_vencimiento ON lotes (id_producto, fecha_vencimiento) "
        "WHERE cantidad_actual > 0"
    )

    # movimientos_kardex
    op.create_table(
        "movimientos_kardex",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("id_producto", UUID(as_uuid=True), sa.ForeignKey("productos.id"), nullable=False),
        sa.Column("id_lote", UUID(as_uuid=True), sa.ForeignKey("lotes.id"), nullable=True),
        sa.Column("id_usuario", UUID(as_uuid=True), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("id_usuario_autoriza", UUID(as_uuid=True), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("cantidad", sa.Integer, nullable=False),
        sa.Column("costo_unitario", sa.Numeric(14, 4), nullable=False),
        sa.Column("saldo_post_movimiento", sa.Integer, nullable=False),
        sa.Column("descripcion", sa.String(500)),
        sa.Column("referencia", sa.String(120)),
        sa.Column("fecha_movimiento", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_kardex_producto_fecha",
        "movimientos_kardex",
        ["id_producto", sa.text("fecha_movimiento DESC")],
    )
    op.create_index(
        "ix_kardex_tipo_fecha",
        "movimientos_kardex",
        ["tipo", "fecha_movimiento"],
    )

    # alertas_sistema
    op.create_table(
        "alertas_sistema",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("id_producto", UUID(as_uuid=True), sa.ForeignKey("productos.id"), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("severidad", sa.String(20), nullable=False, server_default="WARNING"),
        sa.Column("detalle", sa.String(500), nullable=False),
        sa.Column("leida", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("fecha_evaluacion_dia", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("id_producto", "tipo", "fecha_evaluacion_dia", name="uq_alerta_dia"),
    )
    op.create_index("ix_alertas_id_producto", "alertas_sistema", ["id_producto"])


def downgrade() -> None:
    op.drop_table("alertas_sistema")
    op.drop_table("movimientos_kardex")
    op.drop_table("lotes")
    op.drop_table("productos")
    op.drop_table("proveedores")
    op.drop_table("categorias")
    op.drop_table("refresh_tokens")
    op.drop_table("usuarios")
