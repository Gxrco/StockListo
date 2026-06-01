from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class AlertaSistema(UUIDMixin, Base):
    __tablename__ = "alertas_sistema"
    __table_args__ = (
        # Only applies when id_producto IS NOT NULL (NULL values exempt in PG unique index)
        UniqueConstraint("id_producto", "tipo", "fecha_evaluacion_dia", name="uq_alerta_dia"),
    )

    id_producto: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("productos.id"), nullable=True, index=True
    )
    id_usuario_solicitante: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True
    )
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)
    severidad: Mapped[str] = mapped_column(String(20), nullable=False, default="WARNING")
    detalle: Mapped[str] = mapped_column(String(500), nullable=False)
    leida: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # PENDIENTE | APROBADA | RECHAZADA | RESUELTA
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDIENTE", index=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    fecha_evaluacion_dia: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    producto: Mapped[Producto | None] = relationship(
        back_populates="alertas", foreign_keys=[id_producto]
    )
    usuario_solicitante: Mapped[Usuario | None] = relationship(
        foreign_keys=[id_usuario_solicitante]
    )


from app.models.producto import Producto  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402
