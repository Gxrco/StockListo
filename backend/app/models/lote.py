from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class Lote(UUIDMixin, Base):
    __tablename__ = "lotes"
    __table_args__ = (
        CheckConstraint("cantidad_actual >= 0", name="ck_lote_cantidad_actual_positive"),
        CheckConstraint("cantidad_actual <= cantidad_inicial", name="ck_lote_cantidad_no_excede"),
        CheckConstraint("cantidad_inicial > 0", name="ck_lote_cantidad_inicial_positive"),
    )

    id_producto: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("productos.id"), nullable=False, index=True
    )
    id_proveedor: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proveedores.id"), nullable=True
    )
    numero_factura: Mapped[str | None] = mapped_column(String(60))
    cantidad_inicial: Mapped[int] = mapped_column(Integer, nullable=False)
    cantidad_actual: Mapped[int] = mapped_column(Integer, nullable=False)
    unidades_por_caja: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    costo_total: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    costo_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    fecha_vencimiento: Mapped[date | None] = mapped_column(Date, nullable=True)
    descripcion: Mapped[str | None] = mapped_column(String(255))
    fecha_ingreso: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    activo: Mapped[bool] = mapped_column(nullable=False, default=True)

    producto: Mapped[Producto] = relationship(back_populates="lotes")
    proveedor: Mapped[Proveedor | None] = relationship(back_populates="lotes")


from app.models.producto import Producto  # noqa: E402
from app.models.proveedor import Proveedor  # noqa: E402
