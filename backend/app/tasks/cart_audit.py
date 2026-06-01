"""Periodic task: audit expired Redis cart keys (logs only — TTL releases locks)."""
import asyncio

from app.worker import celery_app


@celery_app.task(name="app.tasks.cart_audit.audit_expired_carts")
def audit_expired_carts() -> None:
    asyncio.run(_run())


async def _run() -> None:
    from app.core.logging import get_logger
    log = get_logger("cart_audit")
    log.info("cart_audit_sweep_complete")
