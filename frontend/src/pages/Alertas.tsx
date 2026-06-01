import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, CheckCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAlertStore } from "@/stores/alertStore";
import { formatDateTime } from "@/lib/formatters";
import { toast } from "@/components/ui/Toast";

const TIPO_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "STOCK_MINIMO", label: "Stock mínimo" },
  { value: "VENCIMIENTO", label: "Vencimientos" },
  { value: "DESPACHO_AUTORIZAR", label: "Autorizaciones" },
];

function SeverityIcon({ severidad }: { severidad: string }) {
  if (severidad === "CRITICAL") return <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />;
  if (severidad === "WARNING") return <Clock size={16} className="text-yellow-500 shrink-0 mt-0.5" />;
  return <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />;
}

function SeverityChip({ severidad }: { severidad: string }) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700",
    WARNING: "bg-yellow-100 text-yellow-700",
    INFO: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${map[severidad] ?? "bg-gray-100 text-gray-600"}`}>
      {severidad}
    </span>
  );
}

export default function Alertas() {
  const qc = useQueryClient();
  const { setUnreadCount } = useAlertStore();
  const [tipo, setTipo] = useState("");
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);

  const params = new URLSearchParams({ limit: "100" });
  if (tipo) params.set("type", tipo);
  if (soloNoLeidas) params.set("status", "unread");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["alerts", tipo, soloNoLeidas],
    queryFn: () => api.get<any>(`/alerts?${params}`),
    refetchInterval: 30_000,
  });

  const { data: pendingDispatchesData, isLoading: pendingLoading } = useQuery({
    queryKey: ["dispatches", "pending"],
    queryFn: () => api.get<any>("/dispatches?status=pending"),
    enabled: tipo === "" || tipo === "DESPACHO_AUTORIZAR",
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/alerts/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/alerts/mark-all-read"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const runEvaluation = useMutation({
    mutationFn: () => api.post("/alerts/run-evaluation"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const authorizeDispatch = useMutation({
    mutationFn: (dispatchId: string) => api.post(`/dispatches/${dispatchId}/authorize`),
    onSuccess: () => {
      toast.success("Despacho autorizado");
      qc.invalidateQueries({ queryKey: ["dispatches"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => {
      if (e instanceof ApiError) toast.error(e.problem.detail);
      else toast.error("No se pudo autorizar el despacho");
    },
  });

  const pendingDispatches: any[] = pendingDispatchesData?.data ?? [];
  const showAuthorizations = tipo === "" || tipo === "DESPACHO_AUTORIZAR";
  const visibleAlerts: any[] = tipo === "DESPACHO_AUTORIZAR" ? [] : data?.data ?? [];
  const unreadAlerts = visibleAlerts.filter((a) => !a.leida).length;
  const unread = unreadAlerts + pendingDispatches.length;

  useEffect(() => {
    if (data?.meta?.unreadCount !== undefined) {
      setUnreadCount(data.meta.unreadCount + pendingDispatches.length);
    }
  }, [data, pendingDispatches.length, setUnreadCount]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Alertas</h1>
          {unread > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{unread} sin leer</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runEvaluation.mutate()}
            disabled={runEvaluation.isPending}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-(--radius-btn) px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={runEvaluation.isPending ? "animate-spin" : ""} />
            Evaluar ahora
          </button>
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || unreadAlerts === 0}
            className="text-xs text-[hsl(var(--primary))] hover:underline font-medium disabled:opacity-40"
          >
            Marcar todas leídas
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-(--radius-card) p-3 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {TIPO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTipo(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-(--radius-btn) transition-colors ${
                tipo === opt.value
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={soloNoLeidas}
            onChange={(e) => setSoloNoLeidas(e.target.checked)}
            className="rounded"
          />
          Solo no leídas
        </label>
        <button
          onClick={() => refetch()}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${isFetching ? "animate-spin" : ""}`}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {showAuthorizations && (
        <section className="app-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Autorizaciones de despacho</h2>
              <p className="text-xs text-gray-400 mt-0.5">Solicitudes pendientes de aprobación administrativa</p>
            </div>
            <span className="text-xs font-semibold text-[hsl(var(--primary))]">
              {pendingDispatches.length}
            </span>
          </div>
          {pendingLoading ? (
            <p className="px-5 py-6 text-sm text-gray-400">Cargando solicitudes...</p>
          ) : pendingDispatches.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">No hay autorizaciones pendientes.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingDispatches.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {d.productoNombre ?? "Solicitud de despacho"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {d.cantidad} uds. · {d.usuarioNombre ?? "Operador"} · {formatDateTime(d.fecha)}
                    </p>
                  </div>
                  <button
                    onClick={() => authorizeDispatch.mutate(d.id)}
                    disabled={authorizeDispatch.isPending}
                    className="shrink-0 inline-flex items-center gap-2 rounded-(--radius-btn) bg-[hsl(var(--accent))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--accent)/0.85)] disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    Aprobar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Alerts list */}
      <div className="bg-white rounded-(--radius-card) shadow-sm border border-gray-100 divide-y divide-gray-50">
        {isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Cargando...</p>
        ) : visibleAlerts.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Sin alertas en este filtro</p>
          </div>
        ) : (
          visibleAlerts.map((a: any) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                a.leida ? "opacity-50" : "hover:bg-gray-50"
              }`}
            >
              <SeverityIcon severidad={a.severidad} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-800">
                    {a.productoNombre ?? a.productoId ?? "Sistema"}
                  </p>
                  <SeverityChip severidad={a.severidad} />
                  {a.tipo && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {a.tipo.replace("_", " ")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{a.detalle}</p>
                <p className="text-[11px] text-gray-400 mt-1">{formatDateTime(a.createdAt ?? a.created_at)}</p>
              </div>
              {!a.leida && (
                <button
                  onClick={() => markRead.mutate(a.id)}
                  disabled={markRead.isPending}
                  className="shrink-0 text-[11px] text-[hsl(var(--primary))] hover:underline disabled:opacity-50"
                >
                  Marcar leída
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
