import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Activity, ArrowUpDown, Bell, Filter, MoreHorizontal, Package, TrendingUp, Truck } from "lucide-react";
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
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="app-card min-h-28 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon size={16} className={tone ?? "text-[hsl(var(--accent))]"} />
          <p className="text-base font-medium text-gray-900">{label}</p>
        </div>
        {sub && <p className="text-sm text-gray-500">{sub}</p>}
      </div>
      <p className="mt-4 text-2xl font-medium text-gray-900">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
  actions,
  className,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  icon?: React.ElementType;
}) {
  return (
    <section className={`app-card overflow-hidden ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-[hsl(var(--accent))]" />}
          <h2 className="text-base font-medium text-gray-900">{title}</h2>
        </div>
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
      "/alerts?tipo=STOCK_MINIMO&status=unread&limit=5",
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
        title="Dashboard"
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
          sub="Actual"
        />
        <KpiCard
          icon={TrendingUp}
          label="Valor inventario"
          value={isLoading ? "—" : currency(parseFloat(kpis?.totalValorInventario ?? "0"))}
          sub="Actual"
        />
        <KpiCard
          icon={Truck}
          label="Despachos del mes"
          value={isLoading ? "—" : String(kpis?.despachosMes ?? 0)}
          sub="Este mes"
        />
        <KpiCard
          icon={Bell}
          label="Alertas no leídas"
          value={isLoading ? "—" : String(kpis?.alertasNoLeidas ?? 0)}
          sub="Actual"
          tone={kpis && kpis.alertasNoLeidas > 0 ? "text-[hsl(var(--error))]" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Chart */}
        <Panel
          title="Actividad — Últimos 30 días"
          icon={Activity}
          className="xl:col-span-2"
          actions={
            <div className="flex rounded-btn bg-gray-100 p-1 text-xs">
              <span className="rounded-[calc(var(--radius-btn)-3px)] bg-white px-3 py-1 font-medium text-gray-800 shadow-sm">Mensual</span>
              <span className="px-3 py-1 text-gray-900">Diario</span>
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
        <Panel title="Stock crítico" icon={Bell} className="flex flex-col">
          <div className="flex min-h-55 flex-1 flex-col p-5">
          {criticalAlerts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400 text-center">Sin alertas críticas activas</p>
            </div>
          ) : (
            <ul className="space-y-3 flex-1 overflow-y-auto">
              {criticalAlerts.map((a: any) => (
                <li key={a.id} className="flex items-start gap-2">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {a.productoNombre ?? "Producto"}
                    </p>
                    <p className="text-sm text-gray-500 line-clamp-2">{a.detalle}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </div>
        </Panel>
      </div>

      {/* Recent activity table */}
      <Panel
        title="Últimas transacciones"
        icon={Activity}
        actions={
          <div className="flex items-center gap-2">
            <button className="inline-flex h-8 items-center gap-1.5 rounded-btn border border-[hsl(var(--border))] bg-white px-3 text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <Filter size={14} />
              Filtrar
            </button>
            <button className="inline-flex h-8 items-center gap-1.5 rounded-btn border border-[hsl(var(--border))] bg-white px-3 text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <ArrowUpDown size={14} />
              Ordenar
            </button>
            <button
              aria-label="Más opciones"
              className="grid h-8 w-8 place-items-center rounded-btn border border-[hsl(var(--border))] bg-white text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] bg-white">
              {["Fecha", "Tipo", "Producto", "Cantidad", "Saldo"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-[11px] uppercase tracking-wide font-medium text-gray-500"
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
                <td className="px-5 py-3 text-sm text-gray-500">{formatDateTime(m.fecha)}</td>
                <td className="px-5 py-3">{tipoMovimientoChip(m.tipo)}</td>
                <td className="px-5 py-3 text-sm text-gray-700 max-w-45 truncate">
                  {m.productoNombre ?? "Producto sin nombre"}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-gray-800">{m.cantidad}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{m.saldo ?? "—"}</td>
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
        </div>
      </Panel>
    </div>
  );
}
