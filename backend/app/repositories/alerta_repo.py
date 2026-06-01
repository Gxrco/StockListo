from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import selectinload

from app.models.alerta_sistema import AlertaSistema
from app.models.producto import Producto
from app.repositories.base_repo import BaseRepository


class AlertaRepository(BaseRepository[AlertaSistema]):
    model = AlertaSistema

    @staticmethod
    def _active_alert_condition():
        return and_(
            AlertaSistema.tipo != "DESPACHO_AUTORIZAR",
            or_(
                AlertaSistema.tipo != "STOCK_MINIMO",
                and_(
                    Producto.activo.is_(True),
                    Producto.stock_actual <= Producto.stock_minimo,
                ),
            ),
        )

    async def list_paginated(
        self,
        status: str | None = None,
        tipo: str | None = None,
        cursor_id: uuid.UUID | None = None,
        limit: int = 50,
    ) -> list[AlertaSistema]:
        stmt = (
            select(AlertaSistema)
            .join(Producto, AlertaSistema.id_producto == Producto.id)
            .options(selectinload(AlertaSistema.producto))
            .where(self._active_alert_condition())
        )
        if status == "unread":
            stmt = stmt.where(AlertaSistema.leida.is_(False))
        if tipo:
            stmt = stmt.where(AlertaSistema.tipo == tipo)
        stmt = stmt.order_by(AlertaSistema.created_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_unread(self) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(AlertaSistema)
            .join(Producto, AlertaSistema.id_producto == Producto.id)
            .where(
                AlertaSistema.leida.is_(False),
                self._active_alert_condition(),
            )
        )
        return int(result.scalar_one())

    async def mark_read(self, alerta_id: uuid.UUID) -> None:
        await self.session.execute(
            update(AlertaSistema).where(AlertaSistema.id == alerta_id).values(leida=True)
        )

    async def mark_all_read(self) -> None:
        await self.session.execute(update(AlertaSistema).values(leida=True))

    async def resolve_stale_stock_alerts(self, low_product_ids: set[uuid.UUID]) -> None:
        stmt = update(AlertaSistema).where(
            AlertaSistema.tipo == "STOCK_MINIMO",
            AlertaSistema.leida.is_(False),
        )
        if low_product_ids:
            stmt = stmt.where(AlertaSistema.id_producto.notin_(low_product_ids))
        await self.session.execute(stmt.values(leida=True))

    async def mark_dispatch_authorization_read(self, producto_ids: set[uuid.UUID]) -> None:
        stmt = update(AlertaSistema).where(
            AlertaSistema.tipo == "DESPACHO_AUTORIZAR",
            AlertaSistema.leida.is_(False),
        )
        if producto_ids:
            stmt = stmt.where(AlertaSistema.id_producto.in_(producto_ids))
        await self.session.execute(stmt.values(leida=True))

    async def upsert_for_day(
        self,
        producto_id: uuid.UUID,
        tipo: str,
        severidad: str,
        detalle: str,
        dia: date,
    ) -> None:
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        from app.models.alerta_sistema import AlertaSistema
        import uuid as _uuid
        stmt = pg_insert(AlertaSistema).values(
            id=_uuid.uuid4(),
            id_producto=producto_id,
            tipo=tipo,
            severidad=severidad,
            detalle=detalle,
            leida=False,
            fecha_evaluacion_dia=dia,
        ).on_conflict_do_update(
            constraint="uq_alerta_dia",
            set_={"severidad": severidad, "detalle": detalle, "leida": False},
        )
        await self.session.execute(stmt)
