"""Kardex per-product endpoint with running-balance window function."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.problems import not_found
from app.core.security import CurrentUser, get_current_user
from app.db.uow import AsyncUnitOfWork

router = APIRouter()
AnyAuth = Annotated[CurrentUser, Depends(get_current_user)]

_DEFAULT_FROM = "2000-01-01T00:00:00+00:00"
_DEFAULT_TO = "2099-12-31T23:59:59+00:00"


@router.get("/products/{product_id}")
async def get_kardex(
    product_id: uuid.UUID,
    _: AnyAuth,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    show_balance: bool = Query(default=True, alias="showBalance"),
    cursor: str | None = None,
    limit: int = Query(default=50, le=200),
) -> dict:
    async with AsyncUnitOfWork() as uow:
        p = await uow.productos.find_by_id(product_id)
        if not p:
            raise not_found("Producto")

        from_dt = datetime.fromisoformat(from_) if from_ else datetime.fromisoformat(_DEFAULT_FROM)
        to_dt = datetime.fromisoformat(to) if to else datetime.now(timezone.utc)
        cursor_dt = datetime.fromisoformat(cursor) if cursor else None

        rows = await uow.kardex.list_with_running_balance(
            producto_id=product_id,
            from_dt=from_dt,
            to_dt=to_dt,
            cursor=cursor_dt,
            limit=limit,
        )
        return {
            "data": rows,
            "meta": {"productoId": str(product_id), "productoNombre": p.nombre, "limit": limit},
        }
