import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, CheckCircle, RefreshCw, Check, X } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { api } from "@/lib/api";
import { useAlertStore } from "@/stores/alertStore";
import { formatDateTime } from "@/lib/formatters";
import { toast } from "@/components/ui/Toast";

const TIPO_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "STOCK_MINIMO", label: "Stock" },
  { value: "VENCIMIENTO", label: "Vencimientos" },
  { value: "INGRESO_PENDIENTE", label: "Ingresos" },
  { value: "DESPACHO_PENDIENTE", label: "Despachos" },
];

const AUTH_TIPOS = new Set(["INGRESO_PENDIENTE", "DESPACHO_PENDIENTE"]);

function SeverityIcon({ severidad }: { severidad: string }) {
  if (severidad === "CRITICAL") return <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />;
  if (severidad === "WARNING") return <Clock size={15} className="text-yellow-500 shrink-0 mt-0.5" />;
  return <CheckCircle size={15} className="text-green-500 shrink-0 mt-0.5" />;
}

function TipoChip({ tipo }: { tipo: string }) {
  const styles: Record<string, string> = {
    STOCK_MINIMO: "bg-orange-50 text-orange-600",
    VENCIMIENTO: "bg-red-50 text-red-600",
    INGRESO_PENDIENTE: "bg-green-50 text-green-700",
    DESPACHO_PENDIENTE: "bg-teal-50 text-teal-700",
  };
  const labels: Record<string, string> = {
    STOCK_MINIMO: "Stock mínimo",
    VENCIMIENTO: "Vencimiento",
    INGRESO_PENDIENTE: "Ingreso pendiente",
    DESPACHO_PENDIENTE: "Despacho pendiente",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${styles[tipo] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[tipo] ?? tipo}
    </span>
  );
}

function EstadoChip({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    PENDIENTE: "bg-gray-100 text-gray-500",
    APROBADA: "bg-green-100 text-green-700",
    RECHAZADA: "bg-red-100 text-red-700",
    RESUELTA: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    PENDIENTE: "Leída",
    APROBADA: "Aprobada",
    RECHAZADA: "Rechazada",
    RESUELTA: "Resuelta",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles[estado] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[estado] ?? estado}
    </span>
  );
}

function AlertRow({
  a,
  onMarkRead,
  onApprove,
  onReject,
  actionPending,
}: {
  a: any;
  onMarkRead?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  actionPending?: boolean;
}) {
  const isAuth = AUTH_TIPOS.has(a.tipo);
  const isArchived = Boolean(a.archivada);
  const requiresAction = Boolean(a.requiereAccion);

  return (
    <div className={`flex items-start gap-3 px-5 py-4 transition-colors ${isArchived ? "opacity-60" : "hover:bg-gray-50"}`}>
      <SeverityIcon severidad={a.severidad} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-800">
            {a.productoNombre ?? "Sistema"}
          </p>
          <TipoChip tipo={a.tipo} />
          {a.solicitanteNombre && (
            <span className="text-[10px] text-gray-400">por {a.solicitanteNombre}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{a.detalle}</p>
        <p className="text-[11px] text-gray-400 mt-1">{formatDateTime(a.createdAt)}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isArchived ? (
          <EstadoChip estado={a.estado} />
        ) : isAuth && requiresAction ? (
          <>
            <button
              onClick={onApprove}
              disabled={actionPending}
              className="flex items-center gap-1 text-[11px] font-medium bg-green-700 hover:bg-green-800 text-white px-2.5 py-1 rounded-btn transition-colors disabled:opacity-50"
            >
              <Check size={11} />
              Aprobar
            </button>
            <button
              onClick={onReject}
              disabled={actionPending}
              className="flex items-center gap-1 text-[11px] font-medium border border-red-200 text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-btn transition-colors disabled:opacity-50"
            >
              <X size={11} />
              Rechazar
            </button>
          </>
        ) : !a.leida && onMarkRead ? (
          <button onClick={onMarkRead} className="text-[11px] text-[hsl(var(--primary))] hover:underline">
            Marcar leída
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function Alertas() {
  const qc = useQueryClient();
  const { setUnreadCount } = useAlertStore();
  const [tipo, setTipo] = useState("");
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);

  const buildParams = (archived: boolean) => {
    const p = new URLSearchParams({ limit: "100" });
    if (tipo) p.set("tipo", tipo);
    if (soloNoLeidas && !archived) p.set("status", "unread");
    if (archived) p.set("archived", "true");
    return p.toString();
  };

  const { data: activeData, isLoading: loadingActive, isFetching, refetch } = useQuery({
    queryKey: ["alerts", "active", tipo, soloNoLeidas],
    queryFn: () => api.get<any>(`/alerts?${buildParams(false)}`),
    refetchInterval: 30_000,
  });

  const { data: archivedData, isLoading: loadingArchived } = useQuery({
    queryKey: ["alerts", "archived", tipo],
    queryFn: () => api.get<any>(`/alerts?${buildParams(true)}`),
    staleTime: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/alerts/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/alerts/mark-all-read"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/alerts/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Solicitud aprobada y ejecutada");
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "Error al aprobar"),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.post(`/alerts/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.info("Solicitud rechazada");
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "Error al rechazar"),
  });

  const runEvaluation = useMutation({
    mutationFn: () => api.post("/alerts/evaluate"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  useEffect(() => {
    if (activeData?.meta?.unreadCount !== undefined)
      setUnreadCount(activeData.meta.unreadCount);
  }, [activeData, setUnreadCount]);

  const active: any[] = (activeData?.data ?? []).filter((a: any) => !a.archivada);
  const archived: any[] = (archivedData?.data ?? []).filter((a: any) => a.archivada);
  const unread = active.filter((a: any) => !a.leida).length;
  const unreadNonAuth = active.filter((a: any) => !a.leida && !AUTH_TIPOS.has(a.tipo)).length;
  const pendingAuth = active.filter((a: any) => AUTH_TIPOS.has(a.tipo)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Alertas</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {unread > 0 && `${unread} sin leer`}
            {unread > 0 && pendingAuth > 0 && " · "}
            {pendingAuth > 0 && (
              <span className="text-orange-600 font-medium">{pendingAuth} esperan autorización</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runEvaluation.mutate()}
            disabled={runEvaluation.isPending}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-btn px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={runEvaluation.isPending ? "animate-spin" : ""} />
            Evaluar
          </button>
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || unreadNonAuth === 0}
            className="text-xs text-[hsl(var(--primary))] hover:underline font-medium disabled:opacity-40"
          >
            Marcar todas leídas
          </button>
        </div>
      </div>

      {/* Tipo filters */}
      <div className="bg-white rounded-card px-4 py-3 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {TIPO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTipo(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-btn transition-colors ${
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
          <input type="checkbox" checked={soloNoLeidas} onChange={(e) => setSoloNoLeidas(e.target.checked)} className="rounded" />
          Solo no leídas
        </label>
        <button
          onClick={() => refetch()}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${isFetching ? "animate-spin" : ""}`}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Tabs */}
      <Tabs.Root defaultValue="active">
        <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
          <Tabs.List className="flex gap-0 px-4 border-b border-gray-100">
            <Tabs.Trigger
              value="active"
              className="px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:text-[hsl(var(--primary))] border-transparent text-gray-500 hover:text-gray-700"
            >
              Activas
              {active.length > 0 && (
                <span className="ml-2 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
                  {active.length}
                </span>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="archived"
              className="px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:text-[hsl(var(--primary))] border-transparent text-gray-500 hover:text-gray-700"
            >
              Archivadas
              {archived.length > 0 && (
                <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                  {archived.length}
                </span>
              )}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="active" className="divide-y divide-gray-50">
            {loadingActive ? (
              <p className="px-5 py-10 text-center text-sm text-gray-400">Cargando...</p>
            ) : active.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin alertas activas</p>
              </div>
            ) : active.map((a: any) => (
              <AlertRow
                key={a.id}
                a={a}
                onMarkRead={() => markRead.mutate(a.id)}
                onApprove={() => approveMut.mutate(a.id)}
                onReject={() => rejectMut.mutate(a.id)}
                actionPending={approveMut.isPending || rejectMut.isPending}
              />
            ))}
          </Tabs.Content>

          <Tabs.Content value="archived" className="divide-y divide-gray-50">
            {loadingArchived ? (
              <p className="px-5 py-10 text-center text-sm text-gray-400">Cargando...</p>
            ) : archived.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-400">Sin alertas archivadas</p>
            ) : archived.map((a: any) => (
              <AlertRow key={a.id} a={a} />
            ))}
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
