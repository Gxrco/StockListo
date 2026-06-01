from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken
from app.repositories.base_repo import BaseRepository


def _hash_jti(jti: str) -> str:
    return hashlib.sha256(jti.encode()).hexdigest()


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    async def find_by_jti(self, jti: str) -> RefreshToken | None:
        h = _hash_jti(jti)
        result = await self.session.execute(
            select(RefreshToken).where(RefreshToken.jti_hash == h)
        )
        return result.scalar_one_or_none()

    async def revoke_all_for_user(self, usuario_id: uuid.UUID) -> None:
        from sqlalchemy import update
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.usuario_id == usuario_id)
            .values(revoked=True)
        )

    def create(self, usuario_id: uuid.UUID, jti: str, expires_at: datetime) -> RefreshToken:
        token = RefreshToken(
            usuario_id=usuario_id,
            jti_hash=_hash_jti(jti),
            expires_at=expires_at,
            revoked=False,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(token)
        return token
