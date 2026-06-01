"""Celery application with Beat schedule."""
from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "stocklisto",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.low_stock", "app.tasks.expiring_lots", "app.tasks.cart_audit"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "evaluate-low-stock-every-5min": {
            "task": "app.tasks.low_stock.evaluate_low_stock",
            "schedule": 300,
        },
        "evaluate-expiring-lots-daily": {
            "task": "app.tasks.expiring_lots.evaluate_expiring_lots",
            "schedule": crontab(hour=6, minute=0),
        },
        "cart-audit-every-minute": {
            "task": "app.tasks.cart_audit.audit_expired_carts",
            "schedule": 60,
        },
    },
)
