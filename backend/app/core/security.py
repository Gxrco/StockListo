"""JWT helpers, argon2id password hashing, and RBAC dependencies."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.problems import forbidden, invalid_credentials

_ph = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)


# ── Passwords ─────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# ── JWT ───────────────────────────────────────────────────────────────────────

def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _decode(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def create_access_token(user_id: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TTL_MIN)
    return _encode({"sub": user_id, "role": role, "type": "access", "exp": exp, "jti": str(uuid.uuid4())})


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """Returns (token, jti) — jti is stored hashed in refresh_tokens table."""
    jti = str(uuid.uuid4())
    exp = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
    token = _encode({"sub": user_id, "type": "refresh", "exp": exp, "jti": jti})
    return token, jti


def decode_token(token: str) -> dict[str, Any]:
    try:
        return _decode(token)
    except JWTError:
        raise invalid_credentials("Token inválido o expirado.")


# ── Current user dependency ───────────────────────────────────────────────────

class CurrentUser:
    def __init__(self, id: str, role: str, email: str) -> None:
        self.id = id
        self.role = role
        self.email = email


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    if not credentials:
        raise invalid_credentials("Se requiere autenticación.")
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise invalid_credentials("Se requiere token de acceso.")
    # The actual DB lookup happens in the auth router; here we just trust the JWT.
    return CurrentUser(id=payload["sub"], role=payload["role"], email=payload.get("email", ""))


def require_role(*roles: str):
    """Dependency factory that enforces RBAC."""
    async def _check(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in roles:
            raise forbidden(f"Se requiere rol: {', '.join(roles)}.")
        return user
    return _check
