from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.categoria import Categoria
from app.repositories.base_repo import BaseRepository


class CategoriaRepository(BaseRepository[Categoria]):
    model = Categoria

    async def list_active(self) -> list[Categoria]:
        result = await self.session.execute(
            select(Categoria).where(Categoria.activo.is_(True)).order_by(Categoria.nombre)
        )
        return list(result.scalars().all())

    async def find_by_nombre(self, nombre: str) -> Categoria | None:
        result = await self.session.execute(
            select(Categoria).where(Categoria.nombre == nombre)
        )
        return result.scalar_one_or_none()
