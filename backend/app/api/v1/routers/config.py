from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.security import CurrentUser, require_role
from app.db.uow import AsyncUnitOfWork
from app.models.configuracion_sistema import ConfiguracionSistema

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role("ADMIN"))]


def _serialize(cfg: ConfiguracionSistema) -> dict:
    return {
        "alertasStockActivas": cfg.alertas_stock_activas,
        "alertasVencimientoActivas": cfg.alertas_vencimiento_activas,
        "alertasIngresoPendiente": cfg.alertas_ingreso_pendiente,
        "alertasDespachoPendiente": cfg.alertas_despacho_pendiente,
        "diasAnticipacionVencimiento": cfg.dias_anticipacion_vencimiento,
        "requerirAuthIngresoOperador": cfg.requerir_auth_ingreso_operador,
        "requerirAuthDespacho": cfg.requerir_auth_despacho,
        "despachoAuthUmbralUnidades": cfg.despacho_auth_umbral_unidades,
        "despachoAuthUmbralMonto": str(cfg.despacho_auth_umbral_monto),
    }


class ConfigUpdate(BaseModel):
    alertasStockActivas: bool | None = None
    alertasVencimientoActivas: bool | None = None
    alertasIngresoPendiente: bool | None = None
    alertasDespachoPendiente: bool | None = None
    diasAnticipacionVencimiento: int | None = Field(default=None, ge=1, le=365)
    requerirAuthIngresoOperador: bool | None = None
    requerirAuthDespacho: bool | None = None
    despachoAuthUmbralUnidades: int | None = Field(default=None, ge=1)
    despachoAuthUmbralMonto: Decimal | None = Field(default=None, ge=0)


_FIELD_MAP = {
    "alertasStockActivas": "alertas_stock_activas",
    "alertasVencimientoActivas": "alertas_vencimiento_activas",
    "alertasIngresoPendiente": "alertas_ingreso_pendiente",
    "alertasDespachoPendiente": "alertas_despacho_pendiente",
    "diasAnticipacionVencimiento": "dias_anticipacion_vencimiento",
    "requerirAuthIngresoOperador": "requerir_auth_ingreso_operador",
    "requerirAuthDespacho": "requerir_auth_despacho",
    "despachoAuthUmbralUnidades": "despacho_auth_umbral_unidades",
    "despachoAuthUmbralMonto": "despacho_auth_umbral_monto",
}


@router.get("")
async def get_config(_: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        cfg = await uow.config.get_or_create()
        return {"data": _serialize(cfg)}


@router.patch("")
async def update_config(body: ConfigUpdate, _: AdminOnly) -> dict:
    async with AsyncUnitOfWork() as uow:
        cfg = await uow.config.get_or_create()
        for camel_key, val in body.model_dump(exclude_none=True).items():
            snake_key = _FIELD_MAP[camel_key]
            setattr(cfg, snake_key, val)
        await uow.commit()
        return {"data": _serialize(cfg)}
