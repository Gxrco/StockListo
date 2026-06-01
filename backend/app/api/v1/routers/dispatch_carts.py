from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import CurrentUser, require_role
from app.db.uow import AsyncUnitOfWork
from app.services.dispatch_service import DispatchService

router = APIRouter()
OperatorOrAdmin = Annotated[CurrentUser, Depends(require_role("ADMIN", "OPERATOR"))]


class AddItemRequest(BaseModel):
    productId: uuid.UUID
    cantidad: int
    unit: str = "unidad"


@router.post("", status_code=201)
async def create_cart(current_user: OperatorOrAdmin) -> dict:
    import uuid as _uuid
    async with AsyncUnitOfWork() as uow:
        return {"data": await DispatchService(uow).create_cart(_uuid.UUID(current_user.id))}


@router.get("/{cart_id}")
async def get_cart(cart_id: str, _: OperatorOrAdmin) -> dict:
    async with AsyncUnitOfWork() as uow:
        return {"data": await DispatchService(uow).get_cart(cart_id)}


@router.delete("/{cart_id}", status_code=204)
async def delete_cart(cart_id: str, _: OperatorOrAdmin) -> None:
    async with AsyncUnitOfWork() as uow:
        await DispatchService(uow).delete_cart(cart_id)


@router.post("/{cart_id}/items", status_code=201)
async def add_item(cart_id: str, body: AddItemRequest, current_user: OperatorOrAdmin) -> dict:
    import uuid as _uuid
    async with AsyncUnitOfWork() as uow:
        result = await DispatchService(uow).add_item(
            cart_id=cart_id,
            producto_id=body.productId,
            cantidad=body.cantidad,
            unit=body.unit,
            usuario_id=_uuid.UUID(current_user.id),
        )
        return {"data": result}


@router.delete("/{cart_id}/items/{line_id}", status_code=204)
async def remove_item(cart_id: str, line_id: str, _: OperatorOrAdmin) -> None:
    async with AsyncUnitOfWork() as uow:
        await DispatchService(uow).remove_item(cart_id, line_id)


@router.post("/{cart_id}/checkout")
async def checkout(cart_id: str, current_user: OperatorOrAdmin) -> dict:
    import uuid as _uuid
    async with AsyncUnitOfWork() as uow:
        result = await DispatchService(uow).checkout(
            cart_id,
            _uuid.UUID(current_user.id),
            current_user.role,
        )
        return {"data": result}
