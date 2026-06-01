"""Dispatch history and authorization endpoints."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select

from app.core.problems import not_found
from app.core.security import CurrentUser, require_role
from app.db.uow import AsyncUnitOfWork
from app.models.movimiento_kardex import MovimientoKardex

router = APIRouter()
AdminOrOperator = Annotated[CurrentUser, Depends(require_role("ADMIN", "OPERATOR"))]
AdminOnly = Annotated[CurrentUser, Depends(require_role("ADMIN"))]


@router.get("")
async def list_dispatches(
    _: AdminOrOperator,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    status: str | None = None,
) -> dict:
    async with AsyncUnitOfWork() as uow:
        rows = await uow.kardex.list_recent(limit=500)
        authorized_refs = {
            r.referencia
            for r in rows
            if r.tipo == "DESPACHO" and r.cantidad == 0 and r.referencia
        }
        dispatches = [
            r
            for r in rows
            if r.tipo in ("DESPACHO", "DESPACHO_PENDIENTE")
            and not (r.tipo == "DESPACHO" and r.cantidad == 0 and r.referencia)
            and not (r.tipo == "DESPACHO_PENDIENTE" and r.cantidad == 0)
            and not (r.tipo == "DESPACHO_PENDIENTE" and str(r.id) in authorized_refs)
            and not (r.tipo == "DESPACHO_PENDIENTE" and r.referencia in authorized_refs)
        ]

        if status == "pending":
            pending_groups: dict[str, dict] = {}
            for d in dispatches:
                if d.tipo != "DESPACHO_PENDIENTE":
                    continue
                group_id = d.referencia or str(d.id)
                group = pending_groups.setdefault(
                    group_id,
                    {
                        "id": group_id,
                        "tipo": "DESPACHO_PENDIENTE",
                        "productoId": str(d.id_producto),
                        "productoNombre": "",
                        "productos": set(),
                        "usuarioNombre": d.usuario.nombre if d.usuario else None,
                        "cantidad": 0,
                        "costoTotal": 0.0,
                        "fecha": d.fecha_movimiento.isoformat(),
                        "referencia": group_id,
                        "movimientoIds": [],
                    },
                )
                product_name = d.producto.nombre if d.producto else str(d.id_producto)
                group["productos"].add(product_name)
                group["cantidad"] += abs(d.cantidad)
                group["costoTotal"] += float(abs(d.cantidad) * d.costo_unitario)
                group["movimientoIds"].append(str(d.id))
                if d.fecha_movimiento.isoformat() < group["fecha"]:
                    group["fecha"] = d.fecha_movimiento.isoformat()

            data = []
            for group in pending_groups.values():
                productos = sorted(group.pop("productos"))
                group["productoNombre"] = ", ".join(productos[:2])
                if len(productos) > 2:
                    group["productoNombre"] += f" +{len(productos) - 2}"
                data.append(group)
            data.sort(key=lambda item: item["fecha"], reverse=True)
            return {"data": data}
        elif status == "authorized":
            dispatches = [r for r in dispatches if r.tipo == "DESPACHO"]
        return {
            "data": [
                {
                    "id": str(d.id),
                    "tipo": d.tipo,
                    "productoId": str(d.id_producto),
                    "productoNombre": d.producto.nombre if d.producto else None,
                    "usuarioNombre": d.usuario.nombre if d.usuario else None,
                    "cantidad": d.cantidad,
                    "costoUnitario": str(d.costo_unitario),
                    "fecha": d.fecha_movimiento.isoformat(),
                    "referencia": d.referencia,
                }
                for d in dispatches
            ]
        }


@router.post("/{dispatch_id}/authorize")
async def authorize_dispatch(dispatch_id: str, admin: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        dispatch_uuid: uuid.UUID | None = None
        try:
            dispatch_uuid = uuid.UUID(dispatch_id)
        except ValueError:
            dispatch_uuid = None

        pending_stmt = select(MovimientoKardex).where(
            MovimientoKardex.tipo == "DESPACHO_PENDIENTE",
            MovimientoKardex.cantidad != 0,
        )
        if dispatch_uuid:
            pending_stmt = pending_stmt.where(
                or_(
                    MovimientoKardex.id == dispatch_uuid,
                    MovimientoKardex.referencia == dispatch_id,
                )
            )
        else:
            pending_stmt = pending_stmt.where(MovimientoKardex.referencia == dispatch_id)
        pending_result = await uow.session.execute(pending_stmt)
        pending_movs = list(pending_result.scalars().all())
        if not pending_movs:
            raise not_found("Despacho")

        pending_ids = {str(m.id) for m in pending_movs}
        pending_refs = {m.referencia for m in pending_movs if m.referencia}
        auth_result = await uow.session.execute(
            select(MovimientoKardex).where(
                MovimientoKardex.tipo == "DESPACHO",
                MovimientoKardex.cantidad == 0,
                MovimientoKardex.referencia.in_(pending_ids | pending_refs | {dispatch_id}),
            )
        )
        existing_auth = auth_result.scalars().first()
        if existing_auth:
            return {"data": {"authorized": True, "movimientoId": str(existing_auth.id), "alreadyAuthorized": True}}

        mov = pending_movs[0]
        # Kardex is append-only — create new authorization record
        auth_mov = MovimientoKardex(
            tipo="DESPACHO",
            id_producto=mov.id_producto,
            id_lote=mov.id_lote,
            id_usuario=mov.id_usuario,
            id_usuario_autoriza=uuid.UUID(admin.id),
            cantidad=0,  # no stock change; only status flip
            costo_unitario=mov.costo_unitario,
            saldo_post_movimiento=mov.saldo_post_movimiento,
            descripcion=f"Autorización de despacho {dispatch_id}",
            referencia=str(dispatch_id),
        )
        await uow.kardex.append_movement(auth_mov)
        await uow.alertas.mark_dispatch_authorization_read({m.id_producto for m in pending_movs})
        await uow.commit()
        return {"data": {"authorized": True, "movimientoId": str(auth_mov.id)}}
