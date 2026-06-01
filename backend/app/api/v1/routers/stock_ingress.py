from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, require_role
from app.db.uow import AsyncUnitOfWork
from app.schemas.ingress import StockIngressCreate, StockIngressResponse
from app.services.ingress_service import IngressService

router = APIRouter()
OperatorOrAdmin = Annotated[CurrentUser, Depends(require_role("ADMIN", "OPERATOR"))]


@router.post("", response_model=dict, status_code=201)
async def register_ingress(body: StockIngressCreate, current_user: OperatorOrAdmin) -> dict:
    async with AsyncUnitOfWork() as uow:
        import uuid as _uuid
        result = await IngressService(uow).register(
            producto_id=body.producto_id,
            usuario_id=_uuid.UUID(current_user.id),
            proveedor_id=body.proveedor_id,
            cantidad_cajas=body.cantidad_cajas,
            unidades_por_caja=body.unidades_por_caja,
            costo_total=body.costo_total,
            costo_unitario=body.costo_unitario,
            fecha_vencimiento=body.fecha_vencimiento,
            numero_factura=body.numero_factura,
            descripcion=body.descripcion,
        )
        return {"data": result}
