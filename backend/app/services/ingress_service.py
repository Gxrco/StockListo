"""Stock ingress service — smart quantification and atomic Kardex append."""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from app.core.problems import invalid_credentials, not_found, validation_error
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
        usuario_role: str = "ADMIN",
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

        producto = await self.uow.productos.find_by_id(producto_id)
        if not producto or not producto.activo:
            raise not_found("Producto")

        # OPERATOR → create pending authorization alert, don't touch stock
        if usuario_role != "ADMIN":
            usuario = await self.uow.usuarios.find_by_id(usuario_id)
            if not usuario or not usuario.activo:
                raise invalid_credentials(
                    "La sesión ya no corresponde a un usuario activo. Inicia sesión de nuevo."
                )
            payload = {
                "tipo": "INGRESO",
                "productoId": str(producto_id),
                "productoNombre": producto.nombre,
                "usuarioId": str(usuario_id),
                "proveedorId": str(proveedor_id) if proveedor_id else None,
                "cantidadCajas": cantidad_cajas,
                "unidadesPorCaja": unidades_por_caja,
                "costoTotal": str(costo_total) if costo_total else None,
                "costoUnitario": str(costo_unitario) if costo_unitario else None,
                "fechaVencimiento": fecha_vencimiento.isoformat() if fecha_vencimiento else None,
                "numeroFactura": numero_factura,
                "descripcion": descripcion,
            }
            alerta = await self.uow.alertas.create_auth_alert(
                tipo="INGRESO_PENDIENTE",
                severidad="INFO",
                detalle=f"Ingreso pendiente: {cantidad_cajas} cajas de {producto.nombre} por {self._usuario_nombre(usuario)}",
                payload_json=json.dumps(payload),
                id_usuario_solicitante=usuario_id,
                id_producto=producto_id,
            )
            await self.uow.commit()
            return {"requiresAuthorization": True, "alertaId": str(alerta.id)}

        return await self._execute_ingress(
            producto_id=producto_id,
            usuario_id=usuario_id,
            approver_id=None,
            proveedor_id=proveedor_id,
            cantidad_cajas=cantidad_cajas,
            unidades_por_caja=unidades_por_caja,
            costo_total=costo_total,
            costo_unitario=costo_unitario,
            fecha_vencimiento=fecha_vencimiento,
            numero_factura=numero_factura,
            descripcion=descripcion,
        )

    async def execute_from_payload(self, payload: dict, approver_id: uuid.UUID) -> dict:
        """Execute a previously stored pending ingress payload."""
        from decimal import Decimal
        return await self._execute_ingress(
            producto_id=uuid.UUID(payload["productoId"]),
            usuario_id=uuid.UUID(payload["usuarioId"]),
            approver_id=approver_id,
            proveedor_id=uuid.UUID(payload["proveedorId"]) if payload.get("proveedorId") else None,
            cantidad_cajas=payload["cantidadCajas"],
            unidades_por_caja=payload["unidadesPorCaja"],
            costo_total=Decimal(payload["costoTotal"]) if payload.get("costoTotal") else None,
            costo_unitario=Decimal(payload["costoUnitario"]) if payload.get("costoUnitario") else None,
            fecha_vencimiento=date.fromisoformat(payload["fechaVencimiento"]) if payload.get("fechaVencimiento") else None,
            numero_factura=payload.get("numeroFactura"),
            descripcion=payload.get("descripcion"),
        )

    async def _execute_ingress(
        self,
        *,
        producto_id: uuid.UUID,
        usuario_id: uuid.UUID,
        approver_id: uuid.UUID | None,
        proveedor_id: uuid.UUID | None,
        cantidad_cajas: int,
        unidades_por_caja: int,
        costo_total: Decimal | None,
        costo_unitario: Decimal | None,
        fecha_vencimiento: date | None,
        numero_factura: str | None,
        descripcion: str | None,
    ) -> dict:
        cantidad_unidades = cantidad_cajas * unidades_por_caja

        if costo_total is not None:
            ct = costo_total
            cu = (ct / cantidad_unidades).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            cu = costo_unitario  # type: ignore[assignment]
            ct = (cu * cantidad_unidades).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        producto = await self.uow.productos.find_by_id(producto_id)
        if not producto or not producto.activo:
            raise not_found("Producto")
        if approver_id is not None:
            approver = await self.uow.usuarios.find_by_id(approver_id)
            if not approver or not approver.activo:
                raise invalid_credentials(
                    "La sesión ya no corresponde a un usuario activo. Inicia sesión de nuevo."
                )

        usuario = await self.uow.usuarios.find_by_id(usuario_id)
        movimiento_usuario_id = usuario_id
        if not usuario or not usuario.activo:
            if approver_id is None:
                raise invalid_credentials(
                    "La sesión ya no corresponde a un usuario activo. Inicia sesión de nuevo."
                )
            movimiento_usuario_id = approver_id

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

        old_stock = producto.stock_actual
        old_wac = producto.costo_promedio_ponderado
        new_stock = old_stock + cantidad_unidades
        new_wac = (
            (old_wac * old_stock + cu * cantidad_unidades) / new_stock
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) if new_stock > 0 else cu

        producto.stock_actual = new_stock
        producto.costo_promedio_ponderado = new_wac

        movimiento = MovimientoKardex(
            tipo="INGRESO",
            id_producto=producto_id,
            id_lote=lote.id,
            id_usuario=movimiento_usuario_id,
            id_usuario_autoriza=approver_id,
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

    @staticmethod
    def _usuario_nombre(u: object) -> str:
        return getattr(u, "nombre", "Operador") if u else "Operador"
