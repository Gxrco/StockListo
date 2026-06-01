import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { currency, formatDate, formatDateTime } from "@/lib/formatters";
import { tipoMovimientoChip } from "@/components/ui/StatusChip";

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const [movFrom, setMovFrom] = useState("");
  const [movTo, setMovTo] = useState("");
  const [stockCategory, setStockCategory] = useState("");

  const movParams = new URLSearchParams();
  if (movFrom) movParams.set("from", new Date(movFrom + "T00:00:00").toISOString());
  if (movTo) movParams.set("to", new Date(movTo + "T23:59:59").toISOString());

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<any>("/categories"),
  });
  const categories: any[] = categoriesData?.data ?? [];

  const stockParams = new URLSearchParams();
  if (stockCategory) stockParams.set("category_id", stockCategory);

  const { data: stockData } = useQuery({
    queryKey: ["reports", "stock", stockCategory],
    queryFn: () => api.get<any>(`/reports/stock?${stockParams}`),
  });
  const { data: movData } = useQuery({
    queryKey: ["reports", "movements", movFrom, movTo],
    queryFn: () => api.get<any>(`/reports/movements?${movParams}`),
  });
  const { data: expiryData } = useQuery({
    queryKey: ["reports", "expiry"],
    queryFn: () => api.get<any>("/reports/expiry?withinDays=30"),
  });
  const { data: valData } = useQuery({
    queryKey: ["reports", "valuation"],
    queryFn: () => api.get<any>("/reports/valuation"),
  });

  function exportStock() {
    const rows = stockData?.data ?? [];
    downloadCsv("stock.csv", [
      ["Código", "Nombre", "Categoría", "Stock", "Costo promedio", "Valor total"],
      ...rows.map((p: any) => [p.codigo, p.nombre, p.categoria ?? "", p.stockActual, p.costoPromedio ?? 0, p.valorTotal ?? 0]),
    ]);
  }

  function exportMovements() {
    const rows = movData?.data ?? [];
    downloadCsv("movimientos.csv", [
      ["Fecha", "Tipo", "Producto", "Cantidad", "Costo unit.", "Saldo"],
      ...rows.map((m: any) => [formatDateTime(m.fecha), m.tipo, m.productoNombre ?? m.productoId, m.cantidad, m.costoUnitario ?? 0, m.saldo]),
    ]);
  }

  function exportExpiry() {
    const rows = expiryData?.data ?? [];
    downloadCsv("vencimientos.csv", [
      ["Producto", "Stock", "Vencimiento"],
      ...rows.map((l: any) => [l.productoNombre, l.cantidadActual, formatDate(l.fechaVencimiento)]),
    ]);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Reportes</h1>

      <Tabs.Root defaultValue="stock" className="space-y-4">
        <Tabs.List className="flex gap-1 bg-white p-1 rounded-btn border border-gray-200 w-fit">
          {[
            { value: "stock", label: "Stock" },
            { value: "movements", label: "Movimientos" },
            { value: "expiry", label: "Vencimientos" },
            { value: "valuation", label: "Valorización" },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-4 py-2 text-sm font-medium rounded-[calc(var(--radius-btn)-2px)] transition-colors data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-white text-gray-600 hover:text-gray-900"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Stock Tab */}
        <Tabs.Content value="stock">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Categoría</label>
                <select
                  value={stockCategory}
                  onChange={(e) => setStockCategory(e.target.value)}
                  className="h-9 px-3 border border-gray-200 rounded-btn text-sm bg-white focus:outline-none"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={exportStock}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-btn px-3 py-2 transition-colors"
              >
                <Download size={14} />
                Exportar CSV
              </button>
            </div>
            <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Código", "Nombre", "Categoría", "Stock", "Costo prom.", "Valor total"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] uppercase tracking-wide font-medium text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(stockData?.data ?? []).length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">Sin datos</td></tr>
                  ) : (stockData?.data ?? []).map((p: any) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-xs font-mono text-gray-500">{p.codigo}</td>
                      <td className="px-5 py-3 text-sm text-gray-800">{p.nombre}</td>
                      <td className="px-5 py-3 text-xs text-gray-500">{p.categoria ?? "—"}</td>
                      <td className="px-5 py-3 text-sm font-semibold">{p.stockActual}</td>
                      <td className="px-5 py-3 text-xs">{currency(p.costoPromedio ?? 0)}</td>
                      <td className="px-5 py-3 text-xs font-medium text-[hsl(var(--primary))]">{currency(p.valorTotal ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Tabs.Content>

        {/* Movements Tab */}
        <Tabs.Content value="movements">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap justify-between">
              <div className="flex items-end gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Desde</label>
                  <input type="date" value={movFrom} onChange={(e) => setMovFrom(e.target.value)}
                    className="h-9 px-3 border border-gray-200 rounded-btn text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Hasta</label>
                  <input type="date" value={movTo} onChange={(e) => setMovTo(e.target.value)}
                    className="h-9 px-3 border border-gray-200 rounded-btn text-sm focus:outline-none" />
                </div>
                {(movFrom || movTo) && (
                  <button onClick={() => { setMovFrom(""); setMovTo(""); }}
                    className="h-9 px-3 text-xs text-gray-500 border border-gray-200 rounded-btn hover:bg-gray-50">
                    Limpiar
                  </button>
                )}
              </div>
              <button onClick={exportMovements}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-btn px-3 py-2 transition-colors">
                <Download size={14} />
                Exportar CSV
              </button>
            </div>
            <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Fecha", "Tipo", "Producto", "Cantidad", "Costo unit.", "Saldo"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] uppercase tracking-wide font-medium text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(movData?.data ?? []).length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">Sin movimientos</td></tr>
                  ) : (movData?.data ?? []).map((m: any) => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(m.fecha)}</td>
                      <td className="px-5 py-3">{tipoMovimientoChip(m.tipo)}</td>
                      <td className="px-5 py-3 text-xs text-gray-700">{m.productoNombre ?? m.productoId}</td>
                      <td className={`px-5 py-3 text-sm font-semibold ${m.cantidad > 0 ? "text-green-600" : "text-red-600"}`}>
                        {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                      </td>
                      <td className="px-5 py-3 text-xs">{currency(m.costoUnitario ?? 0)}</td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-700">{m.saldo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Tabs.Content>

        {/* Expiry Tab */}
        <Tabs.Content value="expiry">
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={exportExpiry}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-btn px-3 py-2 transition-colors">
                <Download size={14} />
                Exportar CSV
              </button>
            </div>
            <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Producto", "Stock disponible", "Vence"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] uppercase tracking-wide font-medium text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(expiryData?.data ?? []).length === 0 ? (
                    <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-400">Sin lotes próximos a vencer (30 días)</td></tr>
                  ) : (expiryData?.data ?? []).map((l: any) => (
                    <tr key={l.loteId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm text-gray-800">{l.productoNombre}</td>
                      <td className="px-5 py-3 text-sm font-semibold">{l.cantidadActual}</td>
                      <td className="px-5 py-3 text-xs font-medium text-red-600">{formatDate(l.fechaVencimiento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Tabs.Content>

        {/* Valuation Tab */}
        <Tabs.Content value="valuation">
          {valData?.data ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 bg-[hsl(var(--primary))] rounded-card p-6 text-white">
                <p className="text-[11px] uppercase font-semibold text-white/60 tracking-wide">Valor total inventario</p>
                <p className="text-3xl font-bold mt-2">{currency(valData.data.totalValuacion)}</p>
                <p className="text-sm text-white/60 mt-2">{valData.data.productos} productos activos</p>
              </div>
              <div className="sm:col-span-2 bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {["Producto", "Stock", "Costo prom.", "Valor"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] uppercase tracking-wide font-medium text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(valData.data.detalle ?? []).map((p: any) => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm text-gray-800">{p.nombre}</td>
                        <td className="px-5 py-3 text-sm font-semibold">{p.stockActual}</td>
                        <td className="px-5 py-3 text-xs">{currency(p.costoPromedio ?? 0)}</td>
                        <td className="px-5 py-3 text-xs font-medium text-[hsl(var(--primary))]">{currency(p.valorTotal ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Cargando...</p>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
