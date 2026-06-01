"""Kardex repository — append-only reads and inserts."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select, text
from sqlalchemy.orm import selectinload

from app.models.movimiento_kardex import MovimientoKardex
from app.repositories.base_repo import BaseRepository


class KardexRepository(BaseRepository[MovimientoKardex]):
    model = MovimientoKardex

    async def append_movement(self, movement: MovimientoKardex) -> MovimientoKardex:
        self.session.add(movement)
        await self.session.flush()
        return movement

    async def get_opening_balance(self, producto_id: uuid.UUID, before: datetime) -> int:
        """Sum of quantities for a product before the given datetime."""
        result = await self.session.execute(
            select(func.coalesce(func.sum(MovimientoKardex.cantidad), 0)).where(
                MovimientoKardex.id_producto == producto_id,
                MovimientoKardex.fecha_movimiento < before,
            )
        )
        return int(result.scalar_one())

    async def list_with_running_balance(
        self,
        producto_id: uuid.UUID,
        from_dt: datetime,
        to_dt: datetime,
        cursor: datetime | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """CTE + Window Function query — running balance computed in SQL."""
        opening_balance = await self.get_opening_balance(producto_id, from_dt)

        cursor_clause = "AND fecha_movimiento > :cursor" if cursor else ""
        raw = text(f"""
            WITH movs AS (
                SELECT *
                FROM movimientos_kardex
                WHERE id_producto = :pid
                  AND fecha_movimiento BETWEEN :from_dt AND :to_dt
                  {cursor_clause}
                ORDER BY fecha_movimiento, id
                LIMIT :limit
            )
            SELECT
                m.*,
                :opening_balance + SUM(m.cantidad) OVER (
                    ORDER BY m.fecha_movimiento, m.id
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS saldo_calculado
            FROM movs m
        """)
        params: dict = {
            "pid": str(producto_id),
            "from_dt": from_dt,
            "to_dt": to_dt,
            "limit": limit,
            "opening_balance": opening_balance,
        }
        if cursor:
            params["cursor"] = cursor
        result = await self.session.execute(raw, params)
        return [dict(row._mapping) for row in result]

    async def list_recent(
        self,
        limit: int = 10,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
    ) -> list[MovimientoKardex]:
        q = (
            select(MovimientoKardex)
            .options(selectinload(MovimientoKardex.producto), selectinload(MovimientoKardex.usuario))
            .order_by(MovimientoKardex.fecha_movimiento.desc())
            .limit(limit)
        )
        if from_dt:
            q = q.where(MovimientoKardex.fecha_movimiento >= from_dt)
        if to_dt:
            q = q.where(MovimientoKardex.fecha_movimiento <= to_dt)
        result = await self.session.execute(q)
        return list(result.scalars().all())
