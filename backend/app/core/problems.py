"""RFC 7807 Problem Details catalog."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


PROBLEM_MEDIA_TYPE = "application/problem+json"


@dataclass
class Problem(Exception):
    type: str
    title: str
    status: int
    detail: str
    errors: list[dict[str, Any]] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)

    def response(self) -> JSONResponse:
        body: dict[str, Any] = {
            "type": self.type,
            "title": self.title,
            "status": self.status,
            "detail": self.detail,
        }
        if self.errors:
            body["errors"] = self.errors
        body.update(self.extra)
        return JSONResponse(
            content=body,
            status_code=self.status,
            media_type=PROBLEM_MEDIA_TYPE,
        )


# ── Catalog ──────────────────────────────────────────────────────────────────

def invalid_credentials(detail: str = "Credenciales inválidas.") -> Problem:
    return Problem("invalid_credentials", "Credenciales Inválidas", 401, detail)


def forbidden(detail: str = "No tienes permiso para esta acción.") -> Problem:
    return Problem("forbidden", "Prohibido", 403, detail)


def not_found(resource: str = "Recurso") -> Problem:
    return Problem("not_found", "No Encontrado", 404, f"{resource} no encontrado.")


def validation_error(detail: str, errors: list[dict[str, Any]] | None = None) -> Problem:
    return Problem("validation_error", "Error de Validación", 422, detail, errors or [])


def out_of_stock(detail: str) -> Problem:
    return Problem("out_of_stock", "Stock Insuficiente", 409, detail)


def lock_conflict(detail: str = "Stock reservado por otro usuario.") -> Problem:
    return Problem("lock_conflict", "Conflicto de Reserva", 409, detail)


def rate_limited(detail: str = "Demasiadas solicitudes. Intenta más tarde.") -> Problem:
    return Problem("rate_limited", "Límite de Solicitudes Excedido", 429, detail)


def conflict(detail: str) -> Problem:
    return Problem("conflict", "Conflicto", 409, detail)


def server_error(detail: str = "Error interno del servidor.") -> Problem:
    return Problem("internal_error", "Error Interno", 500, detail)


# ── Exception handlers ────────────────────────────────────────────────────────

async def problem_exception_handler(request: Request, exc: Problem) -> JSONResponse:
    return exc.response()


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    status = exc.status_code
    detail = str(exc.detail)
    mapping = {
        401: ("unauthorized", "No Autorizado"),
        403: ("forbidden", "Prohibido"),
        404: ("not_found", "No Encontrado"),
        405: ("method_not_allowed", "Método No Permitido"),
        429: ("rate_limited", "Límite de Solicitudes Excedido"),
    }
    type_, title = mapping.get(status, ("http_error", "Error HTTP"))
    return JSONResponse(
        content={"type": type_, "title": title, "status": status, "detail": detail},
        status_code=status,
        media_type=PROBLEM_MEDIA_TYPE,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return server_error().response()
