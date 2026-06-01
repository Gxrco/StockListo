import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Search, Package } from "lucide-react";

import { ProductDispatchDialog } from "@/components/dispatch/ProductDispatchDialog";
import { CartDrawer } from "@/components/dispatch/CartDrawer";
import { StatusChip } from "@/components/ui/StatusChip";
import { api, ApiError } from "@/lib/api";
import { currency } from "@/lib/formatters";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export default function Despacho() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q.trim(), 300);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const creatingCartRef = useRef(false);

  const { cartId, setCartId, setItems, clearCart, items } = useCartStore();
  const { user } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function createCart() {
      if (creatingCartRef.current) return;
      creatingCartRef.current = true;
      try {
        const res = await api.post<any>("/dispatch-carts");
        if (!cancelled) {
          setCartId(res.data.cartId);
          setItems([]);
        }
      } catch (e) {
        if (!cancelled && e instanceof ApiError) toast.error(e.problem.detail);
      } finally {
        creatingCartRef.current = false;
      }
    }

    async function ensureCart() {
      if (!user) return;
      if (!cartId) {
        await createCart();
        return;
      }

      try {
        const res = await api.get<any>(`/dispatch-carts/${cartId}`);
        if (!cancelled) setItems(res.data.items ?? []);
      } catch (e) {
        if (e instanceof ApiError && e.problem.type === "not_found") {
          if (!cancelled) {
            clearCart();
            toast.info("El carrito anterior expiró. Se creó uno nuevo.");
          }
          await createCart();
        } else if (!cancelled && e instanceof ApiError) {
          toast.error(e.problem.detail);
        }
      }
    }

    ensureCart();
    return () => {
      cancelled = true;
    };
  }, [user?.id, cartId, setCartId, setItems, clearCart]);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", "dispatch", debouncedQ, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams({
        status: "active",
        q: debouncedQ,
        perPage: "50",
      });
      if (selectedCategory) params.set("category", selectedCategory);
      return api.get<any>(`/products?${params.toString()}`);
    },
    staleTime: 15_000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<any>("/categories"),
  });

  const products = productsData?.data ?? [];
  const categories = categoriesData?.data ?? [];

  const stockBadge = (stockActual: number, stockMinimo: number) => {
    if (stockActual === 0) return <StatusChip variant="critical" label="Sin stock" />;
    if (stockActual <= stockMinimo) return <StatusChip variant="warning" label="Bajo stock" />;
    return null;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Despacho</h1>
          <p className="text-sm text-gray-400 mt-0.5">Selecciona los productos a despachar</p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex items-center gap-2 bg-[hsl(var(--primary))] text-white text-sm font-medium px-4 py-2 rounded-btn hover:bg-[hsl(var(--primary)/0.9)] transition-colors"
        >
          <ShoppingCart size={16} />
          Carrito
          {items.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-[hsl(var(--accent))] text-white rounded-full">
              {items.length}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] bg-white"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-9 px-3 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] bg-white"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* Product grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-card p-4 h-40 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-card p-12 text-center border border-gray-100">
          <Package size={32} className="mx-auto text-gray-200 mb-2" />
          <p className="text-gray-400 text-sm">Sin productos activos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p: any) => {
            const inCart = items.some((i) => i.productoId === p.id);
            const outOfStock = p.stockActual <= 0;
            return (
              <button
                key={p.id}
                onClick={() => !outOfStock && setSelectedProduct(p)}
                disabled={outOfStock}
                aria-disabled={outOfStock}
                className={`bg-white rounded-card p-4 shadow-sm border text-left transition-all relative ${
                  inCart ? "border-[hsl(var(--primary)/0.4)] ring-1 ring-[hsl(var(--primary)/0.2)]" : "border-gray-100"
                } ${outOfStock ? "opacity-50 cursor-not-allowed" : "hover:shadow-md hover:-translate-y-0.5"}`}
              >
                {inCart && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-[hsl(var(--primary))] rounded-full flex items-center justify-center">
                    <ShoppingCart size={9} className="text-white" />
                  </span>
                )}
                <div className="h-16 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                  <span className="text-2xl">📦</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 truncate">{p.nombre}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {p.categoria?.nombre ?? "Sin categoría"}
                </p>
                <div className="flex items-center justify-between mt-2 gap-1">
                  <span className="text-xs text-gray-600 font-medium">{p.stockActual} uds.</span>
                  {stockBadge(p.stockActual, p.stockMinimo)}
                </div>
                <p className="text-xs font-semibold text-[hsl(var(--primary))] mt-1">
                  {currency(parseFloat(p.costoPromedioPonderado ?? "0"))}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <ProductDispatchDialog
        product={selectedProduct}
        cartId={cartId}
        onClose={() => setSelectedProduct(null)}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
