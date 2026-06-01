from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Producto(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "productos"

    codigo: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(500))
    unidad_base: Mapped[str] = mapped_column(String(30), nullable=False, default="unidad")
    stock_minimo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Materialized computed fields — updated by services inside UoW
    stock_actual: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    costo_promedio_ponderado: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))

    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    id_categoria: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categorias.id"), nullable=False
    )
    categoria: Mapped[Categoria] = relationship(back_populates="productos")
    lotes: Mapped[list[Lote]] = relationship(back_populates="producto", cascade="all, delete-orphan")
    movimientos: Mapped[list[MovimientoKardex]] = relationship(back_populates="producto")
    alertas: Mapped[list[AlertaSistema]] = relationship(back_populates="producto")


from app.models.categoria import Categoria  # noqa: E402
from app.models.lote import Lote  # noqa: E402
from app.models.movimiento_kardex import MovimientoKardex  # noqa: E402
from app.models.alerta_sistema import AlertaSistema  # noqa: E402
