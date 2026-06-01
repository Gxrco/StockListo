from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.problems import not_found
from app.core.security import CurrentUser, get_current_user, require_role
from app.db.uow import AsyncUnitOfWork
from app.models.categoria import Categoria

router = APIRouter()
AnyAuth = Annotated[CurrentUser, Depends(get_current_user)]
AdminOnly = Annotated[CurrentUser, Depends(require_role("ADMIN"))]


class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: str | None = None


class CategoriaUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    activo: bool | None = None


@router.get("")
async def list_categories(_: AnyAuth) -> dict:
    async with AsyncUnitOfWork() as uow:
        cats = await uow.categorias.list_active()
        return {"data": [{"id": str(c.id), "nombre": c.nombre, "descripcion": c.descripcion} for c in cats]}


@router.post("", status_code=201)
async def create_category(body: CategoriaCreate, _: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        cat = Categoria(nombre=body.nombre, descripcion=body.descripcion)
        await uow.categorias.add(cat)
        await uow.commit()
        return {"data": {"id": str(cat.id), "nombre": cat.nombre}}


@router.patch("/{cat_id}")
async def update_category(cat_id: uuid.UUID, body: CategoriaUpdate, _: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        cat = await uow.categorias.find_by_id(cat_id)
        if not cat:
            raise not_found("Categoría")
        if body.nombre is not None:
            cat.nombre = body.nombre
        if body.descripcion is not None:
            cat.descripcion = body.descripcion
        if body.activo is not None:
            cat.activo = body.activo
        await uow.commit()
        return {"data": {"id": str(cat.id), "nombre": cat.nombre}}


@router.delete("/{cat_id}", status_code=204)
async def delete_category(cat_id: uuid.UUID, _: AdminOnly) -> None:
    async with AsyncUnitOfWork() as uow:
        cat = await uow.categorias.find_by_id(cat_id)
        if not cat:
            raise not_found("Categoría")
        cat.activo = False
        await uow.commit()
