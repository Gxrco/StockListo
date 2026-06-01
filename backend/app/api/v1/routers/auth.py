"""Auth endpoints: login, refresh, logout, me."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.security import CurrentUser, get_current_user
from app.db.uow import AsyncUnitOfWork
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, TokenResponse, UserRead
from app.services.auth_service import AuthService

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=dict)
async def login(body: LoginRequest) -> dict:
    async with AsyncUnitOfWork() as uow:
        return await AuthService(uow).login(body.email, body.password)


@router.post("/refresh", response_model=dict)
async def refresh(body: RefreshRequest) -> dict:
    async with AsyncUnitOfWork() as uow:
        return await AuthService(uow).refresh(body.refreshToken)


@router.post("/logout", status_code=204)
async def logout(body: LogoutRequest) -> None:
    async with AsyncUnitOfWork() as uow:
        await AuthService(uow).logout(body.refreshToken)


@router.get("/me", response_model=UserRead)
async def me(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> dict:
    import uuid as _uuid
    async with AsyncUnitOfWork() as uow:
        user = await uow.usuarios.find_by_id(_uuid.UUID(current_user.id))
        if not user:
            from app.core.problems import not_found
            raise not_found("Usuario")
        return {"id": str(user.id), "email": user.email, "rol": user.rol, "nombre": user.nombre}
