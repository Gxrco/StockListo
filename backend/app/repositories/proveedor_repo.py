from __future__ import annotations

from sqlalchemy import select

from app.models.proveedor import Proveedor
from app.repositories.base_repo import BaseRepository


class ProveedorRepository(BaseRepository[Proveedor]):
    model = Proveedor

    async def list_active(self) -> list[Proveedor]:
        result = await self.session.execute(
            select(Proveedor).where(Proveedor.activo.is_(True)).order_by(Proveedor.nombre)
        )
        return list(result.scalars().all())
