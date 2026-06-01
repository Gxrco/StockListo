from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.problems import not_found
from app.core.security import CurrentUser, get_current_user, require_role
from app.db.uow import AsyncUnitOfWork
from app.models.proveedor import Proveedor

router = APIRouter()
AnyAuth = Annotated[CurrentUser, Depends(get_current_user)]
AdminOnly = Annotated[CurrentUser, Depends(require_role("ADMIN"))]


class ProveedorCreate(BaseModel):
    nombre: str
    contacto: str | None = None
    telefono: str | None = None
    email: str | None = None


class ProveedorUpdate(BaseModel):
    nombre: str | None = None
    contacto: str | None = None
    telefono: str | None = None
    email: str | None = None
    activo: bool | None = None


@router.get("")
async def list_suppliers(_: AnyAuth) -> dict:
    async with AsyncUnitOfWork() as uow:
        provs = await uow.proveedores.list_active()
        return {"data": [{"id": str(p.id), "nombre": p.nombre, "contacto": p.contacto, "telefono": p.telefono} for p in provs]}


@router.post("", status_code=201)
async def create_supplier(body: ProveedorCreate, _: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        prov = Proveedor(**body.model_dump())
        await uow.proveedores.add(prov)
        await uow.commit()
        return {"data": {"id": str(prov.id), "nombre": prov.nombre}}


@router.patch("/{prov_id}")
async def update_supplier(prov_id: uuid.UUID, body: ProveedorUpdate, _: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        prov = await uow.proveedores.find_by_id(prov_id)
        if not prov:
            raise not_found("Proveedor")
        for field, val in body.model_dump(exclude_none=True).items():
            setattr(prov, field, val)
        await uow.commit()
        return {"data": {"id": str(prov.id), "nombre": prov.nombre}}


@router.delete("/{prov_id}", status_code=204)
async def delete_supplier(prov_id: uuid.UUID, _: AdminOnly) -> None:
    async with AsyncUnitOfWork() as uow:
        prov = await uow.proveedores.find_by_id(prov_id)
        if not prov:
            raise not_found("Proveedor")
        prov.activo = False
        await uow.commit()
