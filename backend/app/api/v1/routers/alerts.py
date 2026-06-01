from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, require_role
from app.core.problems import not_found
from app.db.uow import AsyncUnitOfWork

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role("ADMIN"))]


@router.get("")
async def list_alerts(
    _: AdminOnly,
    status: str | None = None,
    type_: str | None = Query(default=None, alias="type"),
    tipo: str | None = None,
    limit: int = Query(default=50, le=200),
) -> dict:
    async with AsyncUnitOfWork() as uow:
        alerts = await uow.alertas.list_paginated(status=status, tipo=type_ or tipo, limit=limit)
        unread = await uow.alertas.count_unread()
        return {
            "data": [
                {
                    "id": str(a.id),
                    "tipo": a.tipo,
                    "severidad": a.severidad,
                    "detalle": a.detalle,
                    "leida": a.leida,
                    "productoId": str(a.id_producto),
                    "productoNombre": a.producto.nombre if a.producto else None,
                    "fechaEvaluacion": a.fecha_evaluacion_dia.isoformat(),
                    "createdAt": a.created_at.isoformat(),
                }
                for a in alerts
            ],
            "meta": {"unreadCount": unread},
        }


@router.post("/{alert_id}/read", status_code=204)
async def mark_read(alert_id: uuid.UUID, _: AdminOnly) -> None:
    async with AsyncUnitOfWork() as uow:
        a = await uow.alertas.find_by_id(alert_id)
        if not a:
            raise not_found("Alerta")
        await uow.alertas.mark_read(alert_id)
        await uow.commit()


@router.post("/mark-all-read", status_code=204)
async def mark_all_read(_: AdminOnly) -> None:
    async with AsyncUnitOfWork() as uow:
        await uow.alertas.mark_all_read()
        await uow.commit()


@router.post("/run-evaluation", status_code=202)
async def run_evaluation(_: AdminOnly) -> dict:
    from app.tasks.low_stock import run_low_stock_evaluation
    from app.tasks.expiring_lots import _run as run_expiring_lots_evaluation

    await run_low_stock_evaluation()
    await run_expiring_lots_evaluation()
    return {"data": {"status": "evaluated"}}


@router.post("/evaluate", status_code=202)
async def evaluate_now(current_user: AdminOnly) -> dict:
    return await run_evaluation(current_user)
