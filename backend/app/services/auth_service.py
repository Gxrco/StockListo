"""Authentication service — login, refresh, logout."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.problems import forbidden, invalid_credentials
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db.uow import AsyncUnitOfWork
from app.models.usuario import Usuario


class AuthService:
    def __init__(self, uow: AsyncUnitOfWork) -> None:
        self.uow = uow

    async def login(self, email: str, password: str) -> dict:
        user = await self.uow.usuarios.find_by_email(email)
        if not user or not user.activo:
            raise invalid_credentials()
        if not verify_password(password, user.hashed_password):
            raise invalid_credentials()

        access = create_access_token(str(user.id), user.rol)
        refresh, jti = create_refresh_token(str(user.id))
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
        self.uow.refresh_tokens.create(user.id, jti, expires_at)
        await self.uow.commit()

        return {
            "accessToken": access,
            "refreshToken": refresh,
            "tokenType": "bearer",
            "user": _user_data(user),
        }

    async def refresh(self, refresh_token: str) -> dict:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise invalid_credentials("Se requiere refresh token.")

        jti = payload["jti"]
        stored = await self.uow.refresh_tokens.find_by_jti(jti)
        if not stored or stored.revoked:
            # Possible token reuse — revoke entire family
            if stored:
                await self.uow.refresh_tokens.revoke_all_for_user(stored.usuario_id)
                await self.uow.commit()
            raise invalid_credentials("Refresh token inválido o revocado.")

        if stored.expires_at < datetime.now(timezone.utc):
            raise invalid_credentials("Refresh token expirado.")

        # Rotate: revoke old, issue new
        stored.revoked = True
        user = await self.uow.usuarios.find_by_id(stored.usuario_id)
        if not user or not user.activo:
            raise forbidden()

        access = create_access_token(str(user.id), user.rol)
        new_refresh, new_jti = create_refresh_token(str(user.id))
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
        self.uow.refresh_tokens.create(user.id, new_jti, expires_at)
        await self.uow.commit()

        return {
            "accessToken": access,
            "refreshToken": new_refresh,
            "tokenType": "bearer",
        }

    async def logout(self, refresh_token: str) -> None:
        try:
            payload = decode_token(refresh_token)
            jti = payload.get("jti")
            if jti:
                stored = await self.uow.refresh_tokens.find_by_jti(jti)
                if stored:
                    stored.revoked = True
                    await self.uow.commit()
        except Exception:
            pass


def _user_data(user: Usuario) -> dict:
    return {"id": str(user.id), "nombre": user.nombre, "email": user.email, "rol": user.rol}
