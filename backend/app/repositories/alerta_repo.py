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
    auth_alert_types = ("INGRESO_PENDIENTE", "DESPACHO_PENDIENTE")

    def _is_auth_type(self):
        return AlertaSistema.tipo.in_(self.auth_alert_types)

    def _is_non_auth_type(self):
        return AlertaSistema.tipo.notin_(self.auth_alert_types)

    async def list_paginated(
        self,
        status: str | None = None,
        tipo: str | None = None,
        archived: bool = False,
        cursor_id: uuid.UUID | None = None,
        limit: int = 50,
    ) -> list[AlertaSistema]:
        stmt = (
            select(AlertaSistema)
            .outerjoin(Producto, AlertaSistema.id_producto == Producto.id)
            .options(
                selectinload(AlertaSistema.producto),
                selectinload(AlertaSistema.usuario_solicitante),
            )
        )
        if archived:
            stmt = stmt.where(
                or_(
                    and_(self._is_auth_type(), AlertaSistema.estado != "PENDIENTE"),
                    and_(
                        self._is_non_auth_type(),
                        or_(
                            AlertaSistema.leida.is_(True),
                            AlertaSistema.estado != "PENDIENTE",
                        ),
                    ),
                )
            )
        else:
            stmt = stmt.where(
                or_(
                    and_(self._is_auth_type(), AlertaSistema.estado == "PENDIENTE"),
                    and_(
                        self._is_non_auth_type(),
                        AlertaSistema.estado == "PENDIENTE",
                        AlertaSistema.leida.is_(False),
                    ),
                )
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
            .where(
                AlertaSistema.leida.is_(False),
                AlertaSistema.estado == "PENDIENTE",
            )
        )
        return int(result.scalar_one())

    async def mark_read(self, alerta_id: uuid.UUID) -> None:
        await self.session.execute(
            update(AlertaSistema)
            .where(
                AlertaSistema.id == alerta_id,
                self._is_non_auth_type(),
            )
            .values(leida=True, estado="RESUELTA")
        )

    async def mark_all_read(self) -> None:
        await self.session.execute(
            update(AlertaSistema)
            .where(
                AlertaSistema.estado == "PENDIENTE",
                self._is_non_auth_type(),
            )
            .values(leida=True, estado="RESUELTA")
        )

    async def set_estado(self, alerta_id: uuid.UUID, estado: str) -> None:
        await self.session.execute(
            update(AlertaSistema)
            .where(AlertaSistema.id == alerta_id)
            .values(estado=estado, leida=True)
        )

    async def resolve_stale_stock_alerts(self, low_product_ids: set[uuid.UUID]) -> None:
        stmt = update(AlertaSistema).where(
            AlertaSistema.tipo == "STOCK_MINIMO",
            AlertaSistema.estado == "PENDIENTE",
        )
        if low_product_ids:
            stmt = stmt.where(AlertaSistema.id_producto.notin_(low_product_ids))
        await self.session.execute(stmt.values(estado="RESUELTA", leida=True))

    async def upsert_for_day(
        self,
        producto_id: uuid.UUID,
        tipo: str,
        severidad: str,
        detalle: str,
        dia: date,
    ) -> None:
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        import uuid as _uuid
        stmt = pg_insert(AlertaSistema).values(
            id=_uuid.uuid4(),
            id_producto=producto_id,
            tipo=tipo,
            severidad=severidad,
            detalle=detalle,
            leida=False,
            estado="PENDIENTE",
            fecha_evaluacion_dia=dia,
        ).on_conflict_do_update(
            constraint="uq_alerta_dia",
            set_={
                "severidad": severidad,
                "detalle": detalle,
                "leida": False,
                "estado": "PENDIENTE",
            },
            where=and_(
                AlertaSistema.estado == "PENDIENTE",
                AlertaSistema.leida.is_(False),
            ),
        )
        await self.session.execute(stmt)

    async def create_auth_alert(
        self,
        *,
        tipo: str,
        severidad: str,
        detalle: str,
        payload_json: str,
        id_usuario_solicitante: uuid.UUID,
        id_producto: uuid.UUID | None = None,
    ) -> AlertaSistema:
        from datetime import date as _date
        alert_product_id = None if tipo in self.auth_alert_types else id_producto
        alerta = AlertaSistema(
            id_producto=alert_product_id,
            id_usuario_solicitante=id_usuario_solicitante,
            tipo=tipo,
            severidad=severidad,
            detalle=detalle,
            leida=False,
            estado="PENDIENTE",
            payload_json=payload_json,
            fecha_evaluacion_dia=_date.today(),
        )
        self.session.add(alerta)
        await self.session.flush()
        return alerta
