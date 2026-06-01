from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Proveedor(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "proveedores"

    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    contacto: Mapped[str | None] = mapped_column(String(150))
    telefono: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    lotes: Mapped[list[Lote]] = relationship(back_populates="proveedor")


from app.models.lote import Lote  # noqa: E402
