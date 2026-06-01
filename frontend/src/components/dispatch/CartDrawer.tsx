/**
 * Cart drawer (Radix Dialog, side variant):
 *  - Displays cart lines with per-line TTL countdown
 *  - Remove line calls DELETE /dispatch-carts/{cartId}/items/{lineId}
 *  - Checkout calls POST /dispatch-carts/{cartId}/checkout
 *  - Persisted to sessionStorage via cartStore
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ShoppingCart, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { currency } from "@/lib/formatters";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "@/components/ui/Toast";

// ── TTL countdown hook ────────────────────────────────────────────────────────

function useCountdown(expiresAt: number) {
  const [remaining, setRemaining] = useState<number>(
    Math.max(0, Math.floor(expiresAt - Date.now() / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, Math.floor(expiresAt - Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return { remaining, label: `${mm}:${ss}`, expired: remaining === 0 };
}

// ── Cart line component ───────────────────────────────────────────────────────

function CartLine({
  item,
  cartId,
  onRemoved,
}: {
  item: any;
  cartId: string;
  onRemoved: (lineId: string) => void;
}) {
  const { remaining, label, expired } = useCountdown(item.expiresAt);
  const { removeItem } = useCartStore();

  const removeMutation = useMutation({
    mutationFn: () => api.delete(`/dispatch-carts/${cartId}/items/${item.lineId}`),
    onSuccess: () => {
      removeItem(item.lineId);
      onRemoved(item.lineId);
    },
    onError: () => toast.error("Error al eliminar la línea"),
  });

  // Auto-remove locally when TTL expires
  useEffect(() => {
    if (expired) {
      removeItem(item.lineId);
      toast.info(`Reserva de ${item.productoNombre} expiró`);
    }
  }, [expired]);

  const costoLinea = item.lotes?.reduce(
    (acc: number, l: any) => acc + parseFloat(l.costoUnitario) * l.cantidad,
    0,
  ) ?? 0;

  return (
    <div className={`p-3 rounded-btn border transition-colors ${expired ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{item.productoNombre}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {item.cantidad} {item.unit}{item.cantidad > 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-800">{currency(costoLinea)}</p>
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="text-[11px] text-gray-400 hover:text-red-600 transition-colors mt-0.5"
          >
            Quitar
          </button>
        </div>
      </div>

      {/* TTL countdown */}
      <div className={`flex items-center gap-1 mt-2 text-[11px] font-medium ${
        expired ? "text-red-600" : remaining < 120 ? "text-yellow-600" : "text-gray-400"
      }`}>
        <Clock size={11} />
        <span>{expired ? "Reserva expirada" : `Expira en ${label}`}</span>
        {remaining < 120 && !expired && (
          <AlertTriangle size={11} className="text-yellow-500" />
        )}
      </div>
    </div>
  );
}

// ── Cart drawer ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { cartId, items, removeItem, clearCart } = useCartStore();

  const totalCosto = items.reduce((acc, item) => {
    const linea = item.lotes?.reduce(
      (a: number, l: any) => a + parseFloat(l.costoUnitario) * l.cantidad,
      0,
    ) ?? 0;
    return acc + linea;
  }, 0);

  const totalUnidades = items.reduce((acc, item) => acc + item.cantidad, 0);
  const hasExpired = items.some((i) => i.expiresAt - Date.now() / 1000 <= 0);

  const checkoutMutation = useMutation({
    mutationFn: () => api.post<any>(`/dispatch-carts/${cartId}/checkout`),
    onSuccess: (res) => {
      const data = res.data;
      clearCart();
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["dispatches"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      onClose();
      if (data.requiresAuthorization) {
        toast.info("Despacho enviado para autorización del administrador");
      } else {
        toast.success("Despacho confirmado exitosamente");
      }
    },
    onError: (e) => {
      if (e instanceof ApiError && e.problem.type === "not_found") {
        clearCart();
        toast.info("El carrito expiró. Vuelve a agregar los productos.");
      } else if (e instanceof ApiError && e.problem.type === "invalid_credentials") {
        clearCart();
        toast.error(e.problem.detail);
      } else if (e instanceof ApiError) toast.error(e.problem.detail);
      else toast.error("Error al confirmar el despacho");
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-[hsl(var(--primary))]" />
              <h2 className="text-sm font-semibold text-gray-800">Carrito de despacho</h2>
              {items.length > 0 && (
                <span className="text-[11px] font-bold bg-[hsl(var(--primary))] text-white rounded-full px-1.5 py-0.5 leading-none">
                  {items.length}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ShoppingCart size={32} className="text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">El carrito está vacío</p>
                <p className="text-xs text-gray-300 mt-1">Selecciona productos para despachar</p>
              </div>
            ) : (
              items.map((item) =>
                cartId ? (
                  <CartLine
                    key={item.lineId}
                    item={item}
                    cartId={cartId}
                    onRemoved={removeItem}
                  />
                ) : null,
              )
            )}
          </div>

          {/* Footer summary + checkout */}
          {items.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-4 space-y-3">
              {hasExpired && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-btn px-3 py-2">
                  <AlertTriangle size={13} />
                  Algunas reservas expiraron. Agrega los productos de nuevo.
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Total unidades</span>
                <span className="font-semibold text-gray-800">{totalUnidades}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Costo total</span>
                <span className="text-xl font-bold text-[hsl(var(--primary))]">{currency(totalCosto)}</span>
              </div>

              <Button
                variant="accent"
                className="w-full"
                onClick={() => checkoutMutation.mutate()}
                loading={checkoutMutation.isPending}
                disabled={hasExpired || items.length === 0}
              >
                <CheckCircle2 size={16} />
                Confirmar despacho
              </Button>

              <button
                onClick={clearCart}
                className="w-full text-xs text-gray-400 hover:text-red-600 transition-colors py-1"
              >
                Vaciar carrito
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
