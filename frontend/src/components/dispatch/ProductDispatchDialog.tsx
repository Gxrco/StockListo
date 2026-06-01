/**
 * Per-product dispatch modal:
 *  - Shows active lots FIFO with expiry dates
 *  - Toggle Unidades / Cajas with live cost recalculation
 *  - Calls POST /dispatch-carts/{cartId}/items
 *  - On 409 lock_conflict shows inline warning
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { currency, formatDate } from "@/lib/formatters";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "@/components/ui/Toast";

interface Product {
  id: string;
  nombre: string;
  codigo: string;
  stockActual: number;
  unidadBase: string;
  costoPromedioPonderado: string;
  categoria?: { nombre: string };
}

interface Props {
  product: Product | null;
  cartId: string | null;
  onClose: () => void;
}

export function ProductDispatchDialog({ product, cartId, onClose }: Props) {
  const [unit, setUnit] = useState<"unidad" | "caja">("unidad");
  const [cantidad, setCantidad] = useState(1);
  const [lockError, setLockError] = useState<string | null>(null);
  const { setCartId, addItem, clearCart } = useCartStore();

  const { data: lotsData } = useQuery({
    queryKey: ["products", product?.id, "lots"],
    queryFn: () => api.get<any>(`/products/${product!.id}/lots?activeOnly=true`),
    enabled: !!product,
  });

  const lots = lotsData?.data ?? [];
  const firstLot = lots[0];
  const unidadesPorCaja = firstLot?.unidadesPorCaja ?? 1;
  const costoUnitario = parseFloat(firstLot?.costoUnitario ?? product?.costoPromedioPonderado ?? "0");
  const costoEnUnidades = unit === "caja" ? costoUnitario * unidadesPorCaja : costoUnitario;
  const totalCosto = costoEnUnidades * cantidad;

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Sin producto seleccionado");
      setLockError(null);

      const addToCart = (activeCartId: string) =>
        api.post<any>(`/dispatch-carts/${activeCartId}/items`, {
          productId: product.id,
          cantidad,
          unit,
        });

      const createCart = async () => {
        const cart = await api.post<any>("/dispatch-carts");
        setCartId(cart.data.cartId);
        return cart.data.cartId as string;
      };

      let activeCartId = cartId;
      if (!activeCartId) activeCartId = await createCart();

      let res;
      try {
        res = await addToCart(activeCartId);
      } catch (e) {
        if (e instanceof ApiError && e.problem.type === "not_found") {
          clearCart();
          activeCartId = await createCart();
          res = await addToCart(activeCartId);
        } else {
          throw e;
        }
      }
      return res.data;
    },
    onSuccess: (item) => {
      addItem(item);
      toast.success(`${product?.nombre} agregado al carrito`);
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.problem.type === "lock_conflict") {
          setLockError(e.problem.detail);
        } else {
          toast.error(e.problem.detail);
        }
      } else {
        toast.error("Error al agregar al carrito");
      }
    },
  });

  if (!product) return null;

  const maxCantidad = unit === "caja"
    ? Math.floor(product.stockActual / unidadesPorCaja)
    : product.stockActual;

  return (
    <Modal open={!!product} onClose={onClose}>
      <ModalHeader>
        <div className="flex items-center gap-3 pr-8">
          <div className="p-2 bg-[hsl(var(--primary)/0.08)] rounded-xl">
            <Package size={18} className="text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">{product.nombre}</h2>
            <p className="text-xs text-gray-400">{product.codigo} · {product.categoria?.nombre}</p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="space-y-5">
        {/* Stock summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-(--radius-btn) p-3 text-center">
            <p className="text-[11px] uppercase text-gray-400 font-semibold">Stock</p>
            <p className="text-xl font-bold text-gray-800 mt-0.5">{product.stockActual}</p>
            <p className="text-xs text-gray-400">unidades</p>
          </div>
          <div className="bg-gray-50 rounded-(--radius-btn) p-3 text-center">
            <p className="text-[11px] uppercase text-gray-400 font-semibold">Lotes activos</p>
            <p className="text-xl font-bold text-gray-800 mt-0.5">{lots.length}</p>
          </div>
          <div className="bg-gray-50 rounded-(--radius-btn) p-3 text-center">
            <p className="text-[11px] uppercase text-gray-400 font-semibold">Costo prom.</p>
            <p className="text-lg font-bold text-[hsl(var(--primary))] mt-0.5">
              {currency(parseFloat(product.costoPromedioPonderado ?? "0"))}
            </p>
          </div>
        </div>

        {/* Lots FIFO */}
        {lots.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lotes disponibles (FIFO)</p>
            <div className="divide-y divide-gray-50 border border-gray-100 rounded-(--radius-btn)">
              {lots.slice(0, 4).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{l.cantidadActual} uds disponibles</p>
                    <p className="text-[11px] text-gray-400">
                      {l.fechaVencimiento ? `Vence: ${formatDate(l.fechaVencimiento)}` : "Sin vencimiento"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[hsl(var(--primary))]">
                    {currency(parseFloat(l.costoUnitario))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unit toggle */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Unidad de despacho</p>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-(--radius-btn) w-fit">
            {(["unidad", "caja"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => { setUnit(u); setCantidad(1); }}
                className={`px-4 py-1.5 text-xs font-medium rounded-[calc(var(--radius-btn)-2px)] transition-colors capitalize ${
                  unit === u ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {u === "caja" ? `Caja (${unidadesPorCaja} uds)` : "Unidad"}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cantidad</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              className="w-9 h-9 rounded-(--radius-btn) border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg font-medium"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={maxCantidad}
              value={cantidad}
              onChange={(e) => setCantidad(Math.min(maxCantidad, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-20 h-9 text-center border border-gray-200 rounded-(--radius-btn) text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
            />
            <button
              onClick={() => setCantidad((c) => Math.min(maxCantidad, c + 1))}
              className="w-9 h-9 rounded-(--radius-btn) border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg font-medium"
            >
              +
            </button>
            <span className="text-xs text-gray-400">
              máx. {maxCantidad} {unit === "caja" ? "cajas" : "unidades"}
            </span>
          </div>
        </div>

        {/* Cost preview */}
        <div className="bg-[hsl(var(--primary)/0.04)] border border-[hsl(var(--primary)/0.12)] rounded-(--radius-btn) p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">
              {cantidad} {unit}{cantidad > 1 ? "s" : ""}
              {unit === "caja" ? ` × ${unidadesPorCaja} uds = ${cantidad * unidadesPorCaja} unidades` : ""}
            </p>
            <p className="text-xs text-gray-400">{currency(costoEnUnidades)} c/u</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase text-gray-400 font-semibold">Costo total</p>
            <p className="text-2xl font-bold text-[hsl(var(--primary))]">{currency(totalCosto)}</p>
          </div>
        </div>

        {/* Lock conflict warning */}
        {lockError && (
          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-(--radius-btn) px-3 py-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>{lockError}</span>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          onClick={() => addMutation.mutate()}
          loading={addMutation.isPending}
          disabled={cantidad < 1}
        >
          <ShoppingCart size={15} />
          Agregar al carrito
        </Button>
      </ModalFooter>
    </Modal>
  );
}
