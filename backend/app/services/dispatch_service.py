"""Dispatch service — Redis cart reservations + atomic SQL checkout."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.problems import lock_conflict, not_found, out_of_stock, validation_error
from app.db.uow import AsyncUnitOfWork
from app.models.movimiento_kardex import MovimientoKardex

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


CART_TTL = settings.STOCK_LOCK_TTL_SEC
CART_KEY = "cart:{cart_id}:meta"
ITEMS_KEY = "cart:{cart_id}:items"
LOCK_KEY = "lock:lote:{lote_id}:cart:{cart_id}"


class DispatchService:
    def __init__(self, uow: AsyncUnitOfWork) -> None:
        self.uow = uow
        self.redis = get_redis()

    async def create_cart(self, usuario_id: uuid.UUID) -> dict:
        cart_id = str(uuid.uuid4())
        meta = {"usuarioId": str(usuario_id), "createdAt": datetime.now(timezone.utc).isoformat()}
        await self.redis.setex(CART_KEY.format(cart_id=cart_id), CART_TTL, json.dumps(meta))
        return {"cartId": cart_id, "expiresIn": CART_TTL}

    async def get_cart(self, cart_id: str) -> dict:
        meta_raw = await self.redis.get(CART_KEY.format(cart_id=cart_id))
        if not meta_raw:
            raise not_found("Carrito")
        items_raw = await self.redis.hgetall(ITEMS_KEY.format(cart_id=cart_id))
        items = [json.loads(v) for v in items_raw.values()]
        return {**json.loads(meta_raw), "cartId": cart_id, "items": items}

    async def add_item(
        self,
        cart_id: str,
        producto_id: uuid.UUID,
        cantidad: int,
        unit: str,
        usuario_id: uuid.UUID,
    ) -> dict:
        cart_meta = await self.redis.get(CART_KEY.format(cart_id=cart_id))
        if not cart_meta:
            raise not_found("Carrito")

        producto = await self.uow.productos.find_by_id(producto_id)
        if not producto or not producto.activo:
            raise not_found("Producto")

        # Resolve FIFO lots
        lotes = await self.uow.lotes.list_active_for_product(producto_id)
        total_disponible = sum(l.cantidad_actual for l in lotes)

        unidades_solicitadas = cantidad if unit == "unidad" else cantidad * (lotes[0].unidades_por_caja if lotes else 1)
        if unidades_solicitadas > total_disponible:
            raise out_of_stock(f"Solo hay {total_disponible} unidades disponibles.")

        # Reserve lots FIFO
        reserved: list[dict] = []
        remaining = unidades_solicitadas
        rollback_keys: list[str] = []

        for lote in lotes:
            if remaining <= 0:
                break
            qty = min(remaining, lote.cantidad_actual)
            lock_key = LOCK_KEY.format(lote_id=str(lote.id), cart_id=cart_id)
            ok = await self.redis.set(lock_key, qty, nx=True, ex=CART_TTL)
            if not ok:
                # Partial rollback
                for k in rollback_keys:
                    await self.redis.delete(k)
                raise lock_conflict(f"Stock del lote {lote.id} reservado por otro usuario.")
            rollback_keys.append(lock_key)
            reserved.append({"loteId": str(lote.id), "cantidad": qty, "costoUnitario": str(lote.costo_unitario)})
            remaining -= qty

        line_id = str(uuid.uuid4())
        expires_at = (
            datetime.now(timezone.utc).timestamp() + CART_TTL
        )
        item = {
            "lineId": line_id,
            "productoId": str(producto_id),
            "productoNombre": producto.nombre,
            "cantidad": unidades_solicitadas,
            "unit": unit,
            "lotes": reserved,
            "expiresAt": expires_at,
        }
        await self.redis.hset(ITEMS_KEY.format(cart_id=cart_id), line_id, json.dumps(item))
        return item

    async def remove_item(self, cart_id: str, line_id: str) -> None:
        items_key = ITEMS_KEY.format(cart_id=cart_id)
        raw = await self.redis.hget(items_key, line_id)
        if raw:
            item = json.loads(raw)
            for lot_entry in item.get("lotes", []):
                await self.redis.delete(LOCK_KEY.format(lote_id=lot_entry["loteId"], cart_id=cart_id))
            await self.redis.hdel(items_key, line_id)

    async def delete_cart(self, cart_id: str) -> None:
        items_raw = await self.redis.hgetall(ITEMS_KEY.format(cart_id=cart_id))
        for raw in items_raw.values():
            item = json.loads(raw)
            for lot_entry in item.get("lotes", []):
                await self.redis.delete(LOCK_KEY.format(lote_id=lot_entry["loteId"], cart_id=cart_id))
        await self.redis.delete(ITEMS_KEY.format(cart_id=cart_id))
        await self.redis.delete(CART_KEY.format(cart_id=cart_id))

    async def checkout(self, cart_id: str, usuario_id: uuid.UUID, usuario_role: str) -> dict:
        cart = await self.get_cart(cart_id)
        items = cart.get("items", [])
        if not items:
            raise validation_error("El carrito está vacío.")

        total_unidades = sum(i["cantidad"] for i in items)
        total_costo = sum(
            Decimal(lot["costoUnitario"]) * lot["cantidad"]
            for item in items
            for lot in item["lotes"]
        )

        requires_auth = usuario_role != "ADMIN"
        tipo = "DESPACHO_PENDIENTE" if requires_auth else "DESPACHO"

        movimientos_ids: list[str] = []

        for item in items:
            for lot_entry in item["lotes"]:
                lote = await self.uow.lotes.find_by_id(uuid.UUID(lot_entry["loteId"]))
                if not lote:
                    raise not_found("Lote")
                qty = lot_entry["cantidad"]
                if lote.cantidad_actual < qty:
                    raise out_of_stock(f"Lote {lote.id} tiene solo {lote.cantidad_actual} unidades.")

                lote.cantidad_actual -= qty

                producto = await self.uow.productos.find_by_id(lote.id_producto)
                if producto:
                    producto.stock_actual -= qty

                mov = MovimientoKardex(
                    tipo=tipo,
                    id_producto=lote.id_producto,
                    id_lote=lote.id,
                    id_usuario=usuario_id,
                    cantidad=-qty,
                    costo_unitario=lote.costo_unitario,
                    saldo_post_movimiento=producto.stock_actual if producto else 0,
                    referencia=cart_id,
                )
                await self.uow.kardex.append_movement(mov)
                movimientos_ids.append(str(mov.id))

        await self.uow.commit()
        await self.delete_cart(cart_id)

        return {
            "status": tipo,
            "totalUnidades": total_unidades,
            "totalCosto": str(total_costo),
            "movimientos": movimientos_ids,
            "requiresAuthorization": requires_auth,
        }
