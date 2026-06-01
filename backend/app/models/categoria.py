from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Categoria(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "categorias"

    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    productos: Mapped[list[Producto]] = relationship(back_populates="categoria")


from app.models.producto import Producto  # noqa: E402
