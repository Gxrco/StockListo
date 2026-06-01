"""Periodic task: evaluate lots expiring within 30 days."""
import asyncio
from datetime import date, timedelta

from app.worker import celery_app


@celery_app.task(name="app.tasks.expiring_lots.evaluate_expiring_lots", bind=True, max_retries=3)
def evaluate_expiring_lots(self) -> None:
    asyncio.run(_run())


async def _run() -> None:
    from sqlalchemy import select, and_
    from app.db.uow import AsyncUnitOfWork
    from app.models.lote import Lote
    from app.models.producto import Producto

    today = date.today()
    cutoff = today + timedelta(days=30)

    async with AsyncUnitOfWork() as uow:
        result = await uow.session.execute(
            select(Lote, Producto)
            .join(Producto, Lote.id_producto == Producto.id)
            .where(
                and_(
                    Lote.fecha_vencimiento.is_not(None),
                    Lote.fecha_vencimiento <= cutoff,
                    Lote.fecha_vencimiento >= today,
                    Lote.cantidad_actual > 0,
                )
            )
        )
        for lote, prod in result.all():
            dias_restantes = (lote.fecha_vencimiento - today).days
            severidad = "CRITICAL" if dias_restantes <= 7 else "WARNING"
            detalle = (
                f"{prod.nombre}: lote vence en {dias_restantes} días "
                f"({lote.fecha_vencimiento.isoformat()}), {lote.cantidad_actual} unidades."
            )
            await uow.alertas.upsert_for_day(
                producto_id=prod.id,
                tipo="VENCIMIENTO",
                severidad=severidad,
                detalle=detalle,
                dia=today,
            )
        await uow.commit()
