from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usuario import Usuario
from app.repositories.base_repo import BaseRepository


class UsuarioRepository(BaseRepository[Usuario]):
    model = Usuario

    async def find_by_email(self, email: str) -> Usuario | None:
        result = await self.session.execute(select(Usuario).where(Usuario.email == email))
        return result.scalar_one_or_none()

    async def list_all(self, skip: int = 0, limit: int = 50) -> list[Usuario]:
        result = await self.session.execute(
            select(Usuario).order_by(Usuario.nombre).offset(skip).limit(limit)
        )
        return list(result.scalars().all())
