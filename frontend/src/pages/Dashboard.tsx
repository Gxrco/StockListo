import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Package, TrendingUp, Truck, Bell } from "lucide-react";
import { TopHeroCard } from "@/components/layout/TopHeroCard";
import { tipoMovimientoChip } from "@/components/ui/StatusChip";
import { api } from "@/lib/api";
import { currency, formatDateTime } from "@/lib/formatters";
import { useAlertStore } from "@/stores/alertStore";

interface DashboardData {
  totalProductos: number;
  totalValorInventario: string;
  despachosMes: number;
  alertasNoLeidas: number;
  productosStockBajo: number;
  chartData: Array<{ fecha: string; ingresos: number; despachos: number }>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="app-card p-5 flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase font-semibold text-gray-400 tracking-wide">{label}</p>
        <p className="text-2xl font-semibold tracking-[-0.02em] text-gray-900 mt-2">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-(--radius-btn) ${accent ?? "bg-[hsl(var(--primary)/0.08)]"}`}>
        <Icon size={18} className={accent ? "text-white" : "text-[hsl(var(--primary))]"} />
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  actions,
  className,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`app-card overflow-hidden ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const setUnreadCount = useAlertStore((s) => s.setUnreadCount);

  const { data: dashData, isLoading } = useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: () => api.get<{ data: DashboardData }>("/reports/dashboard"),
    refetchInterval: 30_000,
  });

  const { data: recentData } = useQuery({
    queryKey: ["reports", "movements", "recent"],
    queryFn: () => api.get<{ data: any[] }>("/reports/movements"),
    refetchInterval: 30_000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["alerts", "critical"],
    queryFn: () => api.get<{ data: any[]; meta: { unreadCount: number } }>(
      "/alerts?type=STOCK_MINIMO&status=unread&limit=5",
    ),
    refetchInterval: 30_000,
  });

  const { data: pendingDispatchesData } = useQuery({
    queryKey: ["dispatches", "pending"],
    queryFn: () => api.get<{ data: any[] }>("/dispatches?status=pending"),
    refetchInterval: 30_000,
  });

  const kpis = dashData?.data;
  const movements = recentData?.data ?? [];
  const criticalAlerts = alertsData?.data ?? [];
  const pendingDispatches = pendingDispatchesData?.data ?? [];

  useEffect(() => {
    if (alertsData?.meta?.unreadCount !== undefined) {
      setUnreadCount(alertsData.meta.unreadCount + pendingDispatches.length);
    }
  }, [alertsData, pendingDispatches.length, setUnreadCount]);

  const chartData = kpis?.chartData ?? [];

  return (
    <div className="space-y-6">
      <TopHeroCard
        title="Panel de Control"
        subtitle="Inventario en tiempo real"
        stats={kpis ? [
          { label: "Valor inventario", value: currency(parseFloat(kpis.totalValorInventario)) },
          { label: "Productos", value: String(kpis.totalProductos) },
          { label: "Stock bajo", value: String(kpis.productosStockBajo) },
        ] : []}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Package}
          label="Total productos"
          value={isLoading ? "—" : String(kpis?.totalProductos ?? 0)}
        />
        <KpiCard
          icon={TrendingUp}
          label="Valor inventario"
          value={isLoading ? "—" : currency(parseFloat(kpis?.totalValorInventario ?? "0"))}
        />
        <KpiCard
          icon={Truck}
          label="Despachos del mes"
          value={isLoading ? "—" : String(kpis?.despachosMes ?? 0)}
        />
        <KpiCard
          icon={Bell}
          label="Alertas no leídas"
          value={isLoading ? "—" : String(kpis?.alertasNoLeidas ?? 0)}
          accent={kpis && kpis.alertasNoLeidas > 0 ? "bg-[hsl(var(--error))]" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Chart */}
        <Panel
          title="Actividad — Últimos 30 días"
          className="xl:col-span-2"
          actions={
            <div className="flex rounded-(--radius-btn) bg-gray-100 p-1 text-xs">
              <span className="rounded-[calc(var(--radius-btn)-3px)] bg-white px-3 py-1 font-medium text-gray-800 shadow-sm">Mensual</span>
              <span className="px-3 py-1 text-gray-500">Diario</span>
            </div>
          }
        >
          <div className="p-5">
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">
              Sin movimientos en el período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={2} barCategoryGap="30%">
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10 }} width={34} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid hsl(210 20% 88%)" }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="ingresos"
                  fill="hsl(187, 96%, 20%)"
                  radius={[5, 5, 0, 0]}
                  name="Ingresos"
                />
                <Bar
                  dataKey="despachos"
                  fill="hsl(156, 100%, 42%)"
                  radius={[5, 5, 0, 0]}
                  name="Despachos"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
          </div>
        </Panel>

        {/* Critical alerts panel */}
        <Panel title="Stock crítico" className="flex flex-col">
          <div className="flex min-h-55 flex-1 flex-col p-5">
          {criticalAlerts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-gray-400 text-center">Sin alertas críticas activas</p>
            </div>
          ) : (
            <ul className="space-y-3 flex-1 overflow-y-auto">
              {criticalAlerts.map((a: any) => (
                <li key={a.id} className="flex items-start gap-2">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {a.productoNombre ?? "Producto"}
                    </p>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{a.detalle}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </div>
        </Panel>
      </div>

      {/* Recent activity table */}
      <Panel title="Últimas transacciones">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--panel))]">
              {["Fecha", "Tipo", "Producto", "Cantidad", "Saldo"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-[11px] uppercase tracking-wide font-semibold text-gray-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movements.slice(0, 10).map((m: any) => (
              <tr
                key={m.id}
              className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors"
              >
                <td className="px-5 py-3 text-xs text-gray-500">{formatDateTime(m.fecha)}</td>
                <td className="px-5 py-3">{tipoMovimientoChip(m.tipo)}</td>
                <td className="px-5 py-3 text-xs text-gray-700 max-w-45 truncate">
                  {m.productoNombre ?? "Producto sin nombre"}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-gray-800">{m.cantidad}</td>
                <td className="px-5 py-3 text-xs text-gray-500">{m.saldo ?? "—"}</td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                  Sin transacciones registradas aún
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
