import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CartLine {
  lineId: string;
  productoId: string;
  productoNombre: string;
  cantidad: number;
  unit: string;
  expiresAt: number;
  lotes: Array<{ loteId: string; cantidad: number; costoUnitario: string }>;
}

interface CartState {
  cartId: string | null;
  items: CartLine[];
  setCartId: (id: string) => void;
  setItems: (items: CartLine[]) => void;
  addItem: (item: CartLine) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      cartId: null,
      items: [],
      setCartId: (id) => set({ cartId: id }),
      setItems: (items) => set({ items }),
      addItem: (item) => set((s) => ({ items: [...s.items, item] })),
      removeItem: (lineId) =>
        set((s) => ({ items: s.items.filter((i) => i.lineId !== lineId) })),
      clearCart: () => set({ cartId: null, items: [] }),
    }),
    {
      name: "stocklisto-cart",
      storage: {
        getItem: (k) => { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; },
        setItem: (k, v) => sessionStorage.setItem(k, JSON.stringify(v)),
        removeItem: (k) => sessionStorage.removeItem(k),
      },
    },
  ),
);
