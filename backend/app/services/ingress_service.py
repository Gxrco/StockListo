"""Stock ingress service — smart quantification and atomic Kardex append."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from app.core.problems import not_found, validation_error
from app.db.uow import AsyncUnitOfWork
from app.models.lote import Lote
from app.models.movimiento_kardex import MovimientoKardex


class IngressService:
    def __init__(self, uow: AsyncUnitOfWork) -> None:
        self.uow = uow

    async def register(
        self,
        *,
        producto_id: uuid.UUID,
        usuario_id: uuid.UUID,
        proveedor_id: uuid.UUID | None,
        cantidad_cajas: int,
        unidades_por_caja: int,
        costo_total: Decimal | None,
        costo_unitario: Decimal | None,
        fecha_vencimiento: date | None,
        numero_factura: str | None,
        descripcion: str | None,
    ) -> dict:
        # Validation
        if cantidad_cajas <= 0:
            raise validation_error("cantidad_cajas debe ser mayor a 0.")
        if unidades_por_caja < 1:
            raise validation_error("unidades_por_caja debe ser al menos 1.")
        if costo_total is None and costo_unitario is None:
            raise validation_error("Se requiere costo_total o costo_unitario.")
        if costo_total is not None and costo_unitario is not None:
            raise validation_error("Proporciona solo costo_total o costo_unitario, no ambos.")
        if fecha_vencimiento and fecha_vencimiento <= date.today():
            raise validation_error("fecha_vencimiento debe ser posterior a hoy.")

        cantidad_unidades = cantidad_cajas * unidades_por_caja

        # Smart quantification
        if costo_total is not None:
            ct = costo_total
            cu = (ct / cantidad_unidades).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            cu = costo_unitario  # type: ignore[assignment]
            ct = (cu * cantidad_unidades).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        producto = await self.uow.productos.find_by_id(producto_id)
        if not producto or not producto.activo:
            raise not_found("Producto")

        # Create lot
        lote = Lote(
            id_producto=producto_id,
            id_proveedor=proveedor_id,
            numero_factura=numero_factura,
            cantidad_inicial=cantidad_unidades,
            cantidad_actual=cantidad_unidades,
            unidades_por_caja=unidades_por_caja,
            costo_total=ct,
            costo_unitario=cu,
            fecha_vencimiento=fecha_vencimiento,
            descripcion=descripcion,
        )
        await self.uow.lotes.add(lote)

        # Update product stock and weighted average cost
        old_stock = producto.stock_actual
        old_wac = producto.costo_promedio_ponderado
        new_stock = old_stock + cantidad_unidades
        new_wac = (
            (old_wac * old_stock + cu * cantidad_unidades) / new_stock
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) if new_stock > 0 else cu

        producto.stock_actual = new_stock
        producto.costo_promedio_ponderado = new_wac

        # Kardex entry
        movimiento = MovimientoKardex(
            tipo="INGRESO",
            id_producto=producto_id,
            id_lote=lote.id,
            id_usuario=usuario_id,
            cantidad=cantidad_unidades,
            costo_unitario=cu,
            saldo_post_movimiento=new_stock,
            descripcion=descripcion or f"Ingreso lote #{numero_factura or 'S/N'}",
            referencia=numero_factura,
        )
        await self.uow.kardex.append_movement(movimiento)
        await self.uow.commit()

        return {
            "loteId": str(lote.id),
            "movimientoId": str(movimiento.id),
            "cantidadUnidades": cantidad_unidades,
            "costoUnitario": str(cu),
            "costoTotal": str(ct),
            "stockResultante": new_stock,
        }
