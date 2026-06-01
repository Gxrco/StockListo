from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.problems import not_found, conflict
from app.core.security import CurrentUser, get_current_user, require_role
from app.db.uow import AsyncUnitOfWork
from app.models.producto import Producto
from app.schemas.producto import ProductoCreate, ProductoRead, ProductoUpdate

router = APIRouter()
AnyAuth = Annotated[CurrentUser, Depends(get_current_user)]
AdminOrOp = Annotated[CurrentUser, Depends(require_role("ADMIN", "OPERATOR"))]


@router.get("")
async def list_products(
    _: AnyAuth,
    q: str | None = None,
    category: uuid.UUID | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=500, alias="perPage"),
) -> dict:
    async with AsyncUnitOfWork() as uow:
        skip = (page - 1) * per_page
        products, total = await uow.productos.list_paginated(
            q=q, categoria_id=category, status=status, skip=skip, limit=per_page
        )
        pages = (total + per_page - 1) // per_page
        return {
            "data": [ProductoRead.model_validate(p).model_dump(by_alias=True) for p in products],
            "meta": {"total": total, "page": page, "perPage": per_page, "pages": pages},
        }


@router.post("", status_code=201)
async def create_product(body: ProductoCreate, _: AdminOrOp) -> dict:
    async with AsyncUnitOfWork() as uow:
        existing = await uow.productos.find_by_codigo(body.codigo)
        if existing:
            raise conflict(f"Ya existe un producto con código '{body.codigo}'.")
        cat = await uow.categorias.find_by_id(body.id_categoria)
        if not cat:
            raise not_found("Categoría")
        product = Producto(**body.model_dump(by_alias=False))
        await uow.productos.add(product)
        await uow.commit()
        return {"data": {"id": str(product.id), "codigo": product.codigo, "nombre": product.nombre}}


@router.get("/{product_id}")
async def get_product(product_id: uuid.UUID, _: AnyAuth) -> dict:
    async with AsyncUnitOfWork() as uow:
        p = await uow.productos.find_by_id(product_id)
        if not p:
            raise not_found("Producto")
        return {"data": ProductoRead.model_validate(p).model_dump(by_alias=True)}


@router.patch("/{product_id}")
async def update_product(product_id: uuid.UUID, body: ProductoUpdate, _: AdminOrOp) -> dict:
    async with AsyncUnitOfWork() as uow:
        p = await uow.productos.find_by_id(product_id)
        if not p:
            raise not_found("Producto")
        for field, val in body.model_dump(exclude_none=True, by_alias=False).items():
            setattr(p, field, val)
        await uow.commit()
        return {"data": {"id": str(p.id), "nombre": p.nombre}}


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: uuid.UUID, _: Annotated[CurrentUser, Depends(require_role("ADMIN"))]) -> None:
    async with AsyncUnitOfWork() as uow:
        p = await uow.productos.find_by_id(product_id)
        if not p:
            raise not_found("Producto")
        if p.stock_actual > 0:
            raise conflict("No se puede desactivar un producto con stock activo.")
        p.activo = False
        await uow.commit()


@router.get("/{product_id}/stock")
async def get_product_stock(product_id: uuid.UUID, _: AnyAuth) -> dict:
    async with AsyncUnitOfWork() as uow:
        p = await uow.productos.find_by_id(product_id)
        if not p:
            raise not_found("Producto")
        lotes = await uow.lotes.list_active_for_product(product_id)
        return {
            "data": {
                "stockActual": p.stock_actual,
                "costoPromedio": str(p.costo_promedio_ponderado),
                "lotesActivos": len(lotes),
            }
        }


@router.get("/{product_id}/lots")
async def get_product_lots(
    product_id: uuid.UUID,
    _: AnyAuth,
    active_only: bool = Query(default=True, alias="activeOnly"),
) -> dict:
    async with AsyncUnitOfWork() as uow:
        p = await uow.productos.find_by_id(product_id)
        if not p:
            raise not_found("Producto")
        lotes = await uow.lotes.list_for_product(product_id, active_only=active_only)
        return {
            "data": [
                {
                    "id": str(l.id),
                    "cantidadActual": l.cantidad_actual,
                    "cantidadInicial": l.cantidad_inicial,
                    "unidadesPorCaja": l.unidades_por_caja,
                    "costoUnitario": str(l.costo_unitario),
                    "fechaVencimiento": l.fecha_vencimiento.isoformat() if l.fecha_vencimiento else None,
                    "fechaIngreso": l.fecha_ingreso.isoformat(),
                    "numeroFactura": l.numero_factura,
                }
                for l in lotes
            ]
        }
