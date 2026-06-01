from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from app.core.security import CurrentUser, require_role
from app.core.problems import not_found
from app.db.uow import AsyncUnitOfWork
from app.core.security import hash_password

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role("ADMIN"))]


class UserCreate(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    rol: str = "OPERATOR"


class UserUpdate(BaseModel):
    nombre: str | None = None
    rol: str | None = None
    activo: bool | None = None


@router.get("")
async def list_users(_: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        users = await uow.usuarios.list_all()
        return {"data": [{"id": str(u.id), "nombre": u.nombre, "email": u.email, "rol": u.rol, "activo": u.activo} for u in users]}


@router.post("", status_code=201)
async def create_user(body: UserCreate, _: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        from app.models.usuario import Usuario
        user = Usuario(
            nombre=body.nombre,
            email=body.email,
            hashed_password=hash_password(body.password),
            rol=body.rol,
        )
        await uow.usuarios.add(user)
        await uow.commit()
        return {"data": {"id": str(user.id), "email": user.email, "rol": user.rol}}


@router.patch("/{user_id}")
async def update_user(user_id: uuid.UUID, body: UserUpdate, _: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        user = await uow.usuarios.find_by_id(user_id)
        if not user:
            raise not_found("Usuario")
        if body.nombre is not None:
            user.nombre = body.nombre
        if body.rol is not None:
            user.rol = body.rol
        if body.activo is not None:
            user.activo = body.activo
        await uow.commit()
        return {"data": {"id": str(user.id), "email": user.email, "activo": user.activo}}


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: uuid.UUID, _: AdminOnly) -> None:
    async with AsyncUnitOfWork() as uow:
        user = await uow.usuarios.find_by_id(user_id)
        if not user:
            raise not_found("Usuario")
        user.activo = False
        await uow.commit()
