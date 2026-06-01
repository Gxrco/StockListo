import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { currency, formatDateTime } from "@/lib/formatters";
import { tipoMovimientoChip } from "@/components/ui/StatusChip";

export default function Kardex() {
  const navigate = useNavigate();
  const { productId: paramProductId } = useParams<{ productId?: string }>();
  const [productId, setProductId] = useState<string>(paramProductId ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ["products-selector"],
    queryFn: () => api.get<any>("/products?status=active&perPage=200"),
  });
  const products: any[] = productsData?.data ?? [];
  const productsErrorMessage =
    productsError instanceof ApiError
      ? productsError.problem.detail
      : productsError
      ? "No se pudo cargar el listado de productos."
      : null;

  const params = new URLSearchParams();
  if (from) params.set("from", new Date(from + "T00:00:00").toISOString());
  if (to) params.set("to", new Date(to + "T23:59:59").toISOString());

  const { data, isLoading } = useQuery({
    queryKey: ["kardex", productId, from, to],
    queryFn: () => api.get<any>(`/kardex/products/${productId}?${params}`),
    enabled: !!productId,
  });

  const rows: any[] = data?.data ?? [];
  const meta = data?.meta;

  const totalIngresos = rows.filter((r) => r.cantidad > 0).reduce((s, r) => s + r.cantidad, 0);
  const totalDespachos = rows.filter((r) => r.cantidad < 0).reduce((s, r) => s + Math.abs(r.cantidad), 0);
  const saldoFinal = rows.length > 0 ? (rows[rows.length - 1].saldo_calculado ?? rows[rows.length - 1].saldo_post_movimiento) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-(--radius-btn) hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Kardex</h1>
          {meta?.productoNombre && (
            <p className="text-sm text-gray-500">{meta.productoNombre}</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-(--radius-card) p-4 shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] text-gray-500 mb-1">Producto</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full h-9 px-3 border border-gray-200 rounded-(--radius-btn) text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            disabled={productsLoading || !!productsErrorMessage}
          >
            <option value="">
              {productsLoading ? "Cargando productos..." : "Seleccionar producto..."}
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.codigo})
              </option>
            ))}
          </select>
          {productsErrorMessage && (
            <p className="mt-1 text-xs text-red-600">{productsErrorMessage}</p>
          )}
          {!productsLoading && !productsErrorMessage && products.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">No hay productos activos para mostrar.</p>
          )}
        </div>

        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-(--radius-btn) text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
          />
        </div>

        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-(--radius-btn) text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
          />
        </div>

        {(from || to) && (
          <button
            onClick={() => { setFrom(""); setTo(""); }}
            className="h-9 flex items-center gap-1.5 px-3 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-(--radius-btn) transition-colors"
          >
            <X size={14} />
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-(--radius-card) shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Fecha", "Tipo", "Cantidad", "Costo unit.", "Saldo", "Descripción"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[11px] uppercase tracking-wide font-semibold text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!productId ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                  Selecciona un producto para ver su kardex
                </td>
              </tr>
            ) : isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                  Sin movimientos en el rango seleccionado
                </td>
              </tr>
            ) : (
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDateTime(r.fecha_movimiento)}
                  </td>
                  <td className="px-5 py-3">{tipoMovimientoChip(r.tipo)}</td>
                  <td className={`px-5 py-3 text-sm font-semibold ${r.cantidad > 0 ? "text-green-600" : "text-red-600"}`}>
                    {r.cantidad > 0 ? `+${r.cantidad}` : r.cantidad}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {r.costo_unitario != null ? currency(Number(r.costo_unitario)) : "—"}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-700">
                    {r.saldo_calculado ?? r.saldo_post_movimiento}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 max-w-[220px] truncate">
                    {r.descripcion ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Resumen del período
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs text-green-700 font-semibold">+{totalIngresos}</span>
                  <span className="text-xs text-gray-400 mx-1">/</span>
                  <span className="text-xs text-red-600 font-semibold">-{totalDespachos}</span>
                </td>
                <td className="px-5 py-3" />
                <td className="px-5 py-3 text-sm font-bold text-[hsl(var(--primary))]">
                  {saldoFinal ?? "—"}
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">saldo final</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
