from __future__ import annotations

import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, require_role
from app.core.problems import not_found, validation_error
from app.db.uow import AsyncUnitOfWork

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role("ADMIN"))]


def _payload_product_name(a) -> str | None:
    if a.producto:
        return a.producto.nombre
    if not a.payload_json:
        return None
    try:
        payload = json.loads(a.payload_json)
    except json.JSONDecodeError:
        return None
    if isinstance(payload.get("productoNombre"), str):
        return payload["productoNombre"]
    items = payload.get("items")
    if isinstance(items, list):
        names = [
            item.get("productoNombre")
            for item in items
            if isinstance(item, dict) and isinstance(item.get("productoNombre"), str)
        ]
        if names:
            return ", ".join(names)
    return None


def _serialize_alert(a) -> dict:
    is_auth = a.tipo in ("INGRESO_PENDIENTE", "DESPACHO_PENDIENTE")
    is_archived = (
        a.estado != "PENDIENTE"
        if is_auth
        else a.leida or a.estado != "PENDIENTE"
    )
    return {
        "id": str(a.id),
        "tipo": a.tipo,
        "severidad": a.severidad,
        "estado": a.estado,
        "detalle": a.detalle,
        "leida": a.leida,
        "productoId": str(a.id_producto) if a.id_producto else None,
        "productoNombre": _payload_product_name(a),
        "solicitanteNombre": a.usuario_solicitante.nombre if a.usuario_solicitante else None,
        "requiereAccion": is_auth and a.estado == "PENDIENTE",
        "archivada": is_archived,
        "fechaEvaluacion": a.fecha_evaluacion_dia.isoformat(),
        "createdAt": a.created_at.isoformat(),
    }


@router.get("")
async def list_alerts(
    _: AdminOnly,
    status: str | None = None,
    type_: str | None = Query(default=None, alias="type"),
    tipo: str | None = None,
    archived: bool = False,
    limit: int = Query(default=50, le=200),
) -> dict:
    async with AsyncUnitOfWork() as uow:
        alerts = await uow.alertas.list_paginated(
            status=status, tipo=tipo or type_, archived=archived, limit=limit
        )
        unread = await uow.alertas.count_unread()
        return {
            "data": [_serialize_alert(a) for a in alerts],
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


@router.post("/{alert_id}/approve")
async def approve_alert(alert_id: uuid.UUID, current_user: AdminOnly) -> dict:
    import uuid as _uuid
    async with AsyncUnitOfWork() as uow:
        alerta = await uow.alertas.find_by_id(alert_id)
        if not alerta:
            raise not_found("Alerta")
        if alerta.estado != "PENDIENTE":
            raise validation_error("Esta alerta ya fue procesada.")
        if alerta.tipo not in ("INGRESO_PENDIENTE", "DESPACHO_PENDIENTE"):
            raise validation_error("Solo se pueden aprobar solicitudes de autorización.")
        if not alerta.payload_json:
            raise validation_error("Esta alerta no tiene payload ejecutable.")

        payload = json.loads(alerta.payload_json)
        approver_id = _uuid.UUID(current_user.id)

        if alerta.tipo == "INGRESO_PENDIENTE":
            from app.services.ingress_service import IngressService
            result = await IngressService(uow).execute_from_payload(payload, approver_id)
        else:
            from app.services.dispatch_service import DispatchService
            result = await DispatchService(uow).execute_from_payload(payload, approver_id)

        await uow.alertas.set_estado(alert_id, "APROBADA")
        await uow.commit()
        return {"data": {**result, "alertaId": str(alert_id), "estado": "APROBADA"}}


@router.post("/{alert_id}/reject", status_code=200)
async def reject_alert(alert_id: uuid.UUID, _: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        alerta = await uow.alertas.find_by_id(alert_id)
        if not alerta:
            raise not_found("Alerta")
        if alerta.estado != "PENDIENTE":
            raise validation_error("Esta alerta ya fue procesada.")
        if alerta.tipo not in ("INGRESO_PENDIENTE", "DESPACHO_PENDIENTE"):
            raise validation_error("Solo se pueden rechazar solicitudes de autorización.")
        await uow.alertas.set_estado(alert_id, "RECHAZADA")
        await uow.commit()
        return {"data": {"alertaId": str(alert_id), "estado": "RECHAZADA"}}


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
