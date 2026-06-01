from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Boolean, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ConfiguracionSistema(Base):
    __tablename__ = "configuracion_sistema"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Alert toggles
    alertas_stock_activas: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    alertas_vencimiento_activas: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    alertas_ingreso_pendiente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    alertas_despacho_pendiente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    dias_anticipacion_vencimiento: Mapped[int] = mapped_column(Integer, nullable=False, default=30)

    # Authorization toggles
    requerir_auth_ingreso_operador: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    requerir_auth_despacho: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    despacho_auth_umbral_unidades: Mapped[int] = mapped_column(Integer, nullable=False, default=500)
    despacho_auth_umbral_monto: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("10000.00")
    )
