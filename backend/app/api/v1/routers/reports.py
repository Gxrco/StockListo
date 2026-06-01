"""Reports endpoints — stock snapshot, movements, expiry, valuation, dashboard."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, and_, case

from app.core.security import CurrentUser, require_role
from app.db.uow import AsyncUnitOfWork

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role("ADMIN"))]


@router.get("/stock")
async def report_stock(
    _: AdminOnly,
    category: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
) -> dict:
    cat = category_id or category
    async with AsyncUnitOfWork() as uow:
        products, _ = await uow.productos.list_paginated(categoria_id=cat, limit=500)
        return {
            "data": [
                {
                    "id": str(p.id),
                    "codigo": p.codigo,
                    "nombre": p.nombre,
                    "stockActual": p.stock_actual,
                    "costoPromedio": str(p.costo_promedio_ponderado),
                    "valorTotal": str(p.costo_promedio_ponderado * p.stock_actual),
                    "categoria": p.categoria.nombre if p.categoria else None,
                }
                for p in products
            ]
        }


@router.get("/movements")
async def report_movements(
    _: AdminOnly,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    type_: str | None = Query(default=None, alias="type"),
) -> dict:
    from_dt = datetime.fromisoformat(from_) if from_ else None
    to_dt = datetime.fromisoformat(to) if to else None
    async with AsyncUnitOfWork() as uow:
        rows = await uow.kardex.list_recent(limit=500, from_dt=from_dt, to_dt=to_dt)
        if type_:
            rows = [r for r in rows if r.tipo == type_]
        return {
            "data": [
                {
                    "id": str(r.id),
                    "tipo": r.tipo,
                    "productoId": str(r.id_producto),
                    "productoNombre": r.producto.nombre if r.producto else None,
                    "cantidad": r.cantidad,
                    "costoUnitario": str(r.costo_unitario),
                    "saldo": r.saldo_post_movimiento,
                    "fecha": r.fecha_movimiento.isoformat(),
                }
                for r in rows
            ]
        }


@router.get("/expiry")
async def report_expiry(
    _: AdminOnly,
    within_days: int = Query(default=30, alias="withinDays"),
) -> dict:
    from datetime import timedelta
    from sqlalchemy import select
    from app.models.lote import Lote
    from app.models.producto import Producto

    cutoff = datetime.now(timezone.utc).date() + timedelta(days=within_days)
    async with AsyncUnitOfWork() as uow:
        from sqlalchemy import and_
        result = await uow.session.execute(
            select(Lote, Producto)
            .join(Producto, Lote.id_producto == Producto.id)
            .where(
                and_(
                    Lote.fecha_vencimiento.is_not(None),
                    Lote.fecha_vencimiento <= cutoff,
                    Lote.cantidad_actual > 0,
                )
            )
            .order_by(Lote.fecha_vencimiento.asc())
        )
        rows = result.all()
        return {
            "data": [
                {
                    "loteId": str(lote.id),
                    "productoId": str(lote.id_producto),
                    "productoNombre": prod.nombre,
                    "cantidadActual": lote.cantidad_actual,
                    "fechaVencimiento": lote.fecha_vencimiento.isoformat(),
                }
                for lote, prod in rows
            ]
        }


@router.get("/valuation")
async def report_valuation(_: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        products, _ = await uow.productos.list_paginated(limit=1000)
        total = sum(p.costo_promedio_ponderado * p.stock_actual for p in products)
        return {
            "data": {
                "totalValuacion": str(total),
                "productos": len(products),
                "detalle": [
                    {
                        "id": str(p.id),
                        "nombre": p.nombre,
                        "stockActual": p.stock_actual,
                        "costoPromedio": str(p.costo_promedio_ponderado),
                        "valorTotal": str(p.costo_promedio_ponderado * p.stock_actual),
                    }
                    for p in products
                ],
            }
        }


@router.get("/dashboard")
async def report_dashboard(_: AdminOnly) -> dict:
    """Aggregated KPIs + last-30-day daily chart data for the dashboard."""
    from app.models.movimiento_kardex import MovimientoKardex
    from app.models.producto import Producto

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    async with AsyncUnitOfWork() as uow:
        # KPIs
        products, total_productos = await uow.productos.list_paginated(limit=1)
        _, total_productos_real = await uow.productos.list_paginated(limit=1000)
        all_products, _ = await uow.productos.list_paginated(limit=1000)
        total_valor = sum(p.costo_promedio_ponderado * p.stock_actual for p in all_products)

        # Despachos del mes
        result_despachos = await uow.session.execute(
            select(func.count()).select_from(MovimientoKardex).where(
                and_(
                    MovimientoKardex.tipo == "DESPACHO",
                    MovimientoKardex.fecha_movimiento >= month_start,
                )
            )
        )
        despachos_mes = result_despachos.scalar_one()

        # Daily chart: ingresos and despachos per day for last 30 days
        from sqlalchemy import cast, Date as SADate
        chart_result = await uow.session.execute(
            select(
                cast(MovimientoKardex.fecha_movimiento, SADate).label("dia"),
                MovimientoKardex.tipo,
                func.sum(func.abs(MovimientoKardex.cantidad)).label("total"),
            )
            .where(
                and_(
                    MovimientoKardex.fecha_movimiento >= thirty_days_ago,
                    MovimientoKardex.tipo.in_(["INGRESO", "DESPACHO"]),
                )
            )
            .group_by("dia", MovimientoKardex.tipo)
            .order_by("dia")
        )
        chart_rows = chart_result.all()

        # Build chart dict indexed by date
        chart_map: dict[str, dict] = {}
        for row in chart_rows:
            dia = str(row.dia)
            if dia not in chart_map:
                chart_map[dia] = {"fecha": dia, "ingresos": 0, "despachos": 0}
            if row.tipo == "INGRESO":
                chart_map[dia]["ingresos"] = int(row.total)
            else:
                chart_map[dia]["despachos"] = int(row.total)

        chart_data = list(chart_map.values())

        # Unread alerts count
        unread_alertas = await uow.alertas.count_unread()
        low_stock_count = len(await uow.productos.find_low_stock())

        return {
            "data": {
                "totalProductos": total_productos_real,
                "totalValorInventario": str(total_valor),
                "despachosMes": despachos_mes,
                "alertasNoLeidas": unread_alertas,
                "productosStockBajo": low_stock_count,
                "chartData": chart_data,
            }
        }
