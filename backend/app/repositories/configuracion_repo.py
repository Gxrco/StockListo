from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.configuracion_sistema import ConfiguracionSistema

SINGLETON_ID = 1


class ConfiguracionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_or_create(self) -> ConfiguracionSistema:
        cfg = await self.session.get(ConfiguracionSistema, SINGLETON_ID)
        if cfg is None:
            cfg = ConfiguracionSistema(id=SINGLETON_ID)
            self.session.add(cfg)
            await self.session.flush()
        return cfg
