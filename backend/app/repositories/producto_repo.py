from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.models.producto import Producto
from app.repositories.base_repo import BaseRepository


class ProductoRepository(BaseRepository[Producto]):
    model = Producto

    async def list_paginated(
        self,
        q: str | None = None,
        categoria_id: uuid.UUID | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Producto], int]:
        stmt = select(Producto).options(selectinload(Producto.categoria))
        if q:
            term = f"%{q}%"
            stmt = stmt.where(or_(Producto.nombre.ilike(term), Producto.codigo.ilike(term)))
        if categoria_id:
            stmt = stmt.where(Producto.id_categoria == categoria_id)
        if status == "active":
            stmt = stmt.where(Producto.activo.is_(True))
        elif status == "available":
            stmt = stmt.where(Producto.activo.is_(True), Producto.stock_actual > 0)
        elif status == "low":
            stmt = stmt.where(
                Producto.activo.is_(True),
                Producto.stock_actual > 0,
                Producto.stock_actual <= Producto.stock_minimo,
            )
        elif status == "out":
            stmt = stmt.where(Producto.stock_actual == 0)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()

        rows = await self.session.execute(stmt.order_by(Producto.nombre).offset(skip).limit(limit))
        return list(rows.scalars().all()), total

    async def find_by_codigo(self, codigo: str) -> Producto | None:
        result = await self.session.execute(select(Producto).where(Producto.codigo == codigo))
        return result.scalar_one_or_none()

    async def find_low_stock(self) -> list[Producto]:
        result = await self.session.execute(
            select(Producto).where(
                Producto.activo.is_(True),
                Producto.stock_actual <= Producto.stock_minimo,
            )
        )
        return list(result.scalars().all())
