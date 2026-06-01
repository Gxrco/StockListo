"""FastAPI application factory."""
from __future__ import annotations

import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.core.problems import (
    Problem,
    http_exception_handler,
    problem_exception_handler,
    unhandled_exception_handler,
    rate_limited,
)

configure_logging(debug=settings.DEBUG)
log = get_logger(__name__)

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    # ── Middleware ────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_and_timing(request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.1f}"
        if elapsed_ms > 250:
            log.warning("slow_request", path=request.url.path, ms=round(elapsed_ms))
        return response

    # ── Exception handlers ────────────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, lambda req, exc: rate_limited().response())  # type: ignore[arg-type]
    app.add_exception_handler(Problem, problem_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_exception_handler)  # type: ignore[arg-type]

    # ── Routers ───────────────────────────────────────────────────────────────
    from app.api.v1.routers import health, auth, users, categories, suppliers, products
    from app.api.v1.routers import stock_ingress, dispatch_carts, dispatches, kardex, reports, alerts

    app.include_router(health.router)
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
    app.include_router(categories.router, prefix="/api/v1/categories", tags=["categories"])
    app.include_router(suppliers.router, prefix="/api/v1/suppliers", tags=["suppliers"])
    app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
    app.include_router(stock_ingress.router, prefix="/api/v1/stock-ingress", tags=["stock-ingress"])
    app.include_router(dispatch_carts.router, prefix="/api/v1/dispatch-carts", tags=["dispatch-carts"])
    app.include_router(dispatches.router, prefix="/api/v1/dispatches", tags=["dispatches"])
    app.include_router(kardex.router, prefix="/api/v1/kardex", tags=["kardex"])
    app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
    app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])

    # ── OpenTelemetry (optional) ──────────────────────────────────────────────
    if settings.OTEL_EXPORTER_OTLP_ENDPOINT:
        try:
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
            FastAPIInstrumentor.instrument_app(app)
        except ImportError:
            log.warning("otel_not_available")

    return app


app = create_app()
