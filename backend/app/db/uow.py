"""Async Unit of Work — coordinates multi-row writes atomically."""
from __future__ import annotations

from types import TracebackType
from typing import Self

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.repositories.usuario_repo import UsuarioRepository
from app.repositories.producto_repo import ProductoRepository
from app.repositories.lote_repo import LoteRepository
from app.repositories.kardex_repo import KardexRepository
from app.repositories.alerta_repo import AlertaRepository
from app.repositories.categoria_repo import CategoriaRepository
from app.repositories.proveedor_repo import ProveedorRepository
from app.repositories.refresh_token_repo import RefreshTokenRepository
from app.repositories.configuracion_repo import ConfiguracionRepository


class AsyncUnitOfWork:
    session: AsyncSession

    # Repositories are wired lazily so the UoW can also be used without all of them.
    usuarios: UsuarioRepository
    productos: ProductoRepository
    lotes: LoteRepository
    kardex: KardexRepository
    alertas: AlertaRepository
    categorias: CategoriaRepository
    proveedores: ProveedorRepository
    refresh_tokens: RefreshTokenRepository
    config: ConfiguracionRepository

    async def __aenter__(self) -> Self:
        self.session = async_session_factory()
        self.usuarios = UsuarioRepository(self.session)
        self.productos = ProductoRepository(self.session)
        self.lotes = LoteRepository(self.session)
        self.kardex = KardexRepository(self.session)
        self.alertas = AlertaRepository(self.session)
        self.categorias = CategoriaRepository(self.session)
        self.proveedores = ProveedorRepository(self.session)
        self.refresh_tokens = RefreshTokenRepository(self.session)
        self.config = ConfiguracionRepository(self.session)
        return self

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if exc_type is not None:
            await self.rollback()
        await self.session.close()
