import { useState } from "react";
import { Plus, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IngressWizardDialog } from "@/components/ingress/IngressWizardDialog";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { currency, formatDateTime } from "@/lib/formatters";

export default function Ingreso() {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "movements", "ingreso"],
    queryFn: () => api.get<any>("/reports/movements?type=INGRESO"),
    staleTime: 10_000,
  });

  const movements = (data?.data ?? []).slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Ingreso de producto</h1>
          <p className="text-sm text-gray-400 mt-0.5">Registra nuevos lotes al inventario</p>
        </div>
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Plus size={16} />
          Nuevo ingreso
        </Button>
      </div>

      <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ArrowDownToLine size={15} className="text-[hsl(var(--primary))]" />
          <h2 className="text-sm font-semibold text-gray-700">Últimos ingresos</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {["Fecha", "Producto", "Cantidad (uds)", "Costo unit.", "Referencia"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[11px] uppercase tracking-wide font-medium text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">Cargando...</td></tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <ArrowDownToLine size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">Sin ingresos registrados aún.</p>
                </td>
              </tr>
            ) : movements.map((m: any) => (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors">
                <td className="px-5 py-3 text-xs text-gray-500">{formatDateTime(m.fecha)}</td>
                <td className="px-5 py-3 text-xs text-gray-700">{m.productoNombre ?? "Producto sin nombre"}</td>
                <td className="px-5 py-3 text-sm font-semibold text-gray-800">{m.cantidad}</td>
                <td className="px-5 py-3 text-xs text-gray-600">{currency(m.costoUnitario ?? 0)}</td>
                <td className="px-5 py-3 text-xs text-gray-400 font-mono">{m.referencia ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <IngressWizardDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
