from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import CamelModel


class ProductoCreate(CamelModel):
    codigo: str = Field(min_length=1, max_length=60)
    nombre: str = Field(min_length=1, max_length=200)
    descripcion: str | None = None
    unidad_base: str = "unidad"
    stock_minimo: int = Field(default=0, ge=0)
    id_categoria: uuid.UUID


class ProductoUpdate(CamelModel):
    nombre: str | None = None
    descripcion: str | None = None
    unidad_base: str | None = None
    stock_minimo: int | None = None
    id_categoria: uuid.UUID | None = None


class CategoriaRead(CamelModel):
    id: uuid.UUID
    nombre: str

    model_config = {"from_attributes": True, **CamelModel.model_config}


class ProductoRead(CamelModel):
    id: uuid.UUID
    codigo: str
    nombre: str
    descripcion: str | None
    unidad_base: str
    stock_minimo: int
    stock_actual: int
    costo_promedio_ponderado: Decimal
    activo: bool
    id_categoria: uuid.UUID
    categoria: CategoriaRead | None = None

    model_config = {"from_attributes": True, **CamelModel.model_config}
