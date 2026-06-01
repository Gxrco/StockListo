from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.lote import Lote
from app.repositories.base_repo import BaseRepository


class LoteRepository(BaseRepository[Lote]):
    model = Lote

    async def list_active_for_product(self, producto_id: uuid.UUID) -> list[Lote]:
        """Returns active lots ordered FIFO (expiry ASC NULLS LAST, ingress ASC)."""
        result = await self.session.execute(
            select(Lote)
            .where(
                Lote.id_producto == producto_id,
                Lote.cantidad_actual > 0,
                Lote.activo.is_(True),
            )
            .order_by(Lote.fecha_vencimiento.asc().nullslast(), Lote.fecha_ingreso.asc())
        )
        return list(result.scalars().all())

    async def list_for_product(self, producto_id: uuid.UUID, active_only: bool = False) -> list[Lote]:
        stmt = select(Lote).where(Lote.id_producto == producto_id)
        if active_only:
            stmt = stmt.where(Lote.cantidad_actual > 0, Lote.activo.is_(True))
        result = await self.session.execute(
            stmt.order_by(Lote.fecha_vencimiento.asc().nullslast(), Lote.fecha_ingreso.asc())
        )
        return list(result.scalars().all())
