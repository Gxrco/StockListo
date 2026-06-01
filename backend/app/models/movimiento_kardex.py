"""Append-only Kardex transaction table."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class MovimientoKardex(UUIDMixin, Base):
    """Append-only: no updated_at, no soft-delete, no UPDATE permitted."""
    __tablename__ = "movimientos_kardex"

    tipo: Mapped[str] = mapped_column(String(30), nullable=False)
    id_producto: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("productos.id"), nullable=False, index=True
    )
    id_lote: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lotes.id"), nullable=True
    )
    id_usuario: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False
    )
    id_usuario_autoriza: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True
    )
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    costo_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    saldo_post_movimiento: Mapped[int] = mapped_column(Integer, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(500))
    referencia: Mapped[str | None] = mapped_column(String(120))
    fecha_movimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    producto: Mapped[Producto] = relationship(back_populates="movimientos", foreign_keys=[id_producto])
    lote: Mapped[Lote | None] = relationship(foreign_keys=[id_lote])
    usuario: Mapped[Usuario] = relationship(foreign_keys=[id_usuario])
    usuario_autoriza: Mapped[Usuario | None] = relationship(foreign_keys=[id_usuario_autoriza])


from app.models.producto import Producto  # noqa: E402
from app.models.lote import Lote  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402
