from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import CamelModel


class StockIngressCreate(CamelModel):
    producto_id: uuid.UUID
    proveedor_id: uuid.UUID | None = None
    cantidad_cajas: int = Field(gt=0)
    unidades_por_caja: int = Field(default=1, ge=1)
    costo_total: Decimal | None = Field(default=None, gt=0)
    costo_unitario: Decimal | None = Field(default=None, gt=0)
    fecha_vencimiento: date | None = None
    numero_factura: str | None = None
    descripcion: str | None = None

    @model_validator(mode="after")
    def check_cost_mutually_exclusive(self) -> "StockIngressCreate":
        if self.costo_total is None and self.costo_unitario is None:
            raise ValueError("Se requiere costo_total o costo_unitario.")
        if self.costo_total is not None and self.costo_unitario is not None:
            raise ValueError("Proporciona solo costo_total o costo_unitario, no ambos.")
        return self


class StockIngressResponse(BaseModel):
    loteId: str
    movimientoId: str
    cantidadUnidades: int
    costoUnitario: str
    costoTotal: str
    stockResultante: int
