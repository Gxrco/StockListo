"""Periodic task: evaluate products below minimum stock."""
import asyncio
from datetime import date, timezone, datetime

from app.worker import celery_app


@celery_app.task(name="app.tasks.low_stock.evaluate_low_stock", bind=True, max_retries=3)
def evaluate_low_stock(self) -> None:
    asyncio.run(run_low_stock_evaluation())


async def run_low_stock_evaluation() -> None:
    from app.db.uow import AsyncUnitOfWork

    today = date.today()
    async with AsyncUnitOfWork() as uow:
        low = await uow.productos.find_low_stock()
        low_product_ids = {p.id for p in low}
        await uow.alertas.resolve_stale_stock_alerts(low_product_ids)
        for p in low:
            is_critical = p.stock_actual <= (p.stock_minimo * 0.5)
            severidad = "CRITICAL" if is_critical else "WARNING"
            detalle = (
                f"{p.nombre}: stock actual {p.stock_actual}, mínimo {p.stock_minimo}."
            )
            await uow.alertas.upsert_for_day(
                producto_id=p.id,
                tipo="STOCK_MINIMO",
                severidad=severidad,
                detalle=detalle,
                dia=today,
            )
        await uow.commit()
