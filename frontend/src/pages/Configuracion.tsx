import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Bell, Shield, Tag, Truck,
  Plus, Pencil, Trash2, Check, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-[hsl(var(--primary))] disabled:opacity-50 disabled:pointer-events-none",
        checked ? "bg-[hsl(var(--primary))]" : "bg-gray-200",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-start gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-btn bg-[hsl(var(--primary)/0.08)]">
          <Icon size={16} className="text-[hsl(var(--primary))]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── System config (Alertas + Autorizaciones tabs) ─────────────────────────────
interface SysConfig {
  alertasStockActivas: boolean;
  alertasVencimientoActivas: boolean;
  alertasIngresoPendiente: boolean;
  alertasDespachoPendiente: boolean;
  diasAnticipacionVencimiento: number;
  requerirAuthIngresoOperador: boolean;
  requerirAuthDespacho: boolean;
  despachoAuthUmbralUnidades: number;
  despachoAuthUmbralMonto: string;
}

function AlertasSection({ config, onPatch }: { config: SysConfig; onPatch: (patch: Partial<SysConfig>) => void }) {
  const [dias, setDias] = useState(String(config.diasAnticipacionVencimiento));

  function commitDias() {
    const n = parseInt(dias, 10);
    if (!isNaN(n) && n >= 1 && n <= 365) {
      onPatch({ diasAnticipacionVencimiento: n });
    } else {
      setDias(String(config.diasAnticipacionVencimiento));
    }
  }

  return (
    <Section
      icon={Bell}
      title="Alertas"
      description="Controla qué tipos de alertas se generan automáticamente"
    >
      <SettingRow
        label="Stock mínimo"
        description="Alerta cuando un producto cae por debajo del nivel mínimo configurado"
      >
        <Toggle
          checked={config.alertasStockActivas}
          onChange={(v) => onPatch({ alertasStockActivas: v })}
        />
      </SettingRow>
      <SettingRow
        label="Vencimiento de lotes"
        description="Alerta cuando un lote se acerca a su fecha de vencimiento"
      >
        <Toggle
          checked={config.alertasVencimientoActivas}
          onChange={(v) => onPatch({ alertasVencimientoActivas: v })}
        />
      </SettingRow>
      <SettingRow
        label="Solicitudes de ingreso"
        description="Genera alerta de autorización cuando un operador registra un ingreso"
      >
        <Toggle
          checked={config.alertasIngresoPendiente}
          onChange={(v) => onPatch({ alertasIngresoPendiente: v })}
        />
      </SettingRow>
      <SettingRow
        label="Solicitudes de despacho"
        description="Genera alerta de autorización cuando un operador solicita un despacho"
      >
        <Toggle
          checked={config.alertasDespachoPendiente}
          onChange={(v) => onPatch({ alertasDespachoPendiente: v })}
        />
      </SettingRow>
      <SettingRow
        label="Días de anticipación — vencimientos"
        description="Cuántos días antes del vencimiento se genera la alerta"
      >
        <input
          type="number"
          min={1}
          max={365}
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          onBlur={commitDias}
          onKeyDown={(e) => e.key === "Enter" && commitDias()}
          className={cn(
            "w-20 h-9 px-3 border rounded-btn text-sm text-center bg-white",
            "border-[hsl(var(--border))] focus:outline-none focus:ring-2",
            "focus:ring-[hsl(var(--primary))] focus:border-transparent",
          )}
        />
      </SettingRow>
    </Section>
  );
}

function AutorizacionesSection({ config, onPatch }: { config: SysConfig; onPatch: (patch: Partial<SysConfig>) => void }) {
  const [umbralU, setUmbralU] = useState(String(config.despachoAuthUmbralUnidades));
  const [umbralM, setUmbralM] = useState(config.despachoAuthUmbralMonto);

  function commitUmbralU() {
    const n = parseInt(umbralU, 10);
    if (!isNaN(n) && n >= 1) onPatch({ despachoAuthUmbralUnidades: n });
    else setUmbralU(String(config.despachoAuthUmbralUnidades));
  }

  function commitUmbralM() {
    const n = parseFloat(umbralM);
    if (!isNaN(n) && n >= 0) onPatch({ despachoAuthUmbralMonto: umbralM });
    else setUmbralM(config.despachoAuthUmbralMonto);
  }

  return (
    <Section
      icon={Shield}
      title="Autorizaciones"
      description="Define qué operaciones requieren aprobación del administrador"
    >
      <SettingRow
        label="Autorización en ingreso de operadores"
        description="Los operadores crean una solicitud pendiente en lugar de ejecutar el ingreso directamente"
      >
        <Toggle
          checked={config.requerirAuthIngresoOperador}
          onChange={(v) => onPatch({ requerirAuthIngresoOperador: v })}
        />
      </SettingRow>
      <SettingRow
        label="Autorización en despacho"
        description="Requiere aprobación del administrador antes de ejecutar el despacho"
      >
        <Toggle
          checked={config.requerirAuthDespacho}
          onChange={(v) => onPatch({ requerirAuthDespacho: v })}
        />
      </SettingRow>
      <SettingRow
        label="Umbral de unidades para autorización"
        description="Despachos que superen esta cantidad de unidades requieren autorización"
      >
        <input
          type="number"
          min={1}
          value={umbralU}
          onChange={(e) => setUmbralU(e.target.value)}
          onBlur={commitUmbralU}
          onKeyDown={(e) => e.key === "Enter" && commitUmbralU()}
          className={cn(
            "w-24 h-9 px-3 border rounded-btn text-sm text-center bg-white",
            "border-[hsl(var(--border))] focus:outline-none focus:ring-2",
            "focus:ring-[hsl(var(--primary))] focus:border-transparent",
          )}
        />
      </SettingRow>
      <SettingRow
        label="Umbral de monto para autorización"
        description="Despachos cuyo valor total supere este monto requieren autorización"
      >
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500">Q</span>
          <input
            type="number"
            min={0}
            step={100}
            value={umbralM}
            onChange={(e) => setUmbralM(e.target.value)}
            onBlur={commitUmbralM}
            onKeyDown={(e) => e.key === "Enter" && commitUmbralM()}
            className={cn(
              "w-28 h-9 px-3 border rounded-btn text-sm text-center bg-white",
              "border-[hsl(var(--border))] focus:outline-none focus:ring-2",
              "focus:ring-[hsl(var(--primary))] focus:border-transparent",
            )}
          />
        </div>
      </SettingRow>
    </Section>
  );
}

// ── Categories ────────────────────────────────────────────────────────────────
interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
}

function CategoriasSection() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addNombre, setAddNombre] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ data: Categoria[] }>("/categories"),
  });
  const categorias = data?.data ?? [];

  const createMut = useMutation({
    mutationFn: (body: { nombre: string; descripcion?: string }) =>
      api.post("/categories", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setAddOpen(false);
      setAddNombre("");
      setAddDesc("");
      toast.success("Categoría creada");
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "Error al crear"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { nombre?: string; descripcion?: string } }) =>
      api.patch(`/categories/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setEditId(null);
      toast.success("Categoría actualizada");
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "Error al actualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.info("Categoría eliminada");
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "Error al eliminar"),
  });

  function startEdit(cat: Categoria) {
    setEditId(cat.id);
    setEditNombre(cat.nombre);
    setEditDesc(cat.descripcion ?? "");
    setAddOpen(false);
  }

  function cancelEdit() {
    setEditId(null);
  }

  function saveEdit() {
    if (!editId || !editNombre.trim()) return;
    updateMut.mutate({
      id: editId,
      body: { nombre: editNombre.trim(), descripcion: editDesc.trim() || undefined },
    });
  }

  function saveAdd() {
    if (!addNombre.trim()) return;
    createMut.mutate({ nombre: addNombre.trim(), descripcion: addDesc.trim() || undefined });
  }

  return (
    <Section
      icon={Tag}
      title="Categorías"
      description="Organiza tus productos por categorías. Se requiere al menos una al registrar un producto"
    >
      <div className="px-5 py-3 border-b border-gray-50 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setAddOpen(true); setEditId(null); }}
        >
          <Plus size={13} />
          Nueva categoría
        </Button>
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="px-5 py-4 bg-gray-50/60 border-b border-gray-100">
          <div className="flex items-end gap-3">
            <Input
              label="Nombre"
              value={addNombre}
              onChange={(e) => setAddNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveAdd()}
              autoFocus
              className="w-44"
            />
            <Input
              label="Descripción (opcional)"
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveAdd()}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="primary"
              onClick={saveAdd}
              loading={createMut.isPending}
              disabled={!addNombre.trim()}
            >
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">Cargando...</p>
      ) : categorias.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">Sin categorías registradas</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {categorias.map((cat) =>
            editId === cat.id ? (
              <div key={cat.id} className="flex items-end gap-3 px-5 py-3 bg-gray-50/60">
                <Input
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  autoFocus
                  className="w-44"
                />
                <Input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  placeholder="Descripción"
                  className="flex-1"
                />
                <button
                  onClick={saveEdit}
                  disabled={updateMut.isPending}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-btn bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={cancelEdit}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-btn border border-gray-200 text-gray-500 hover:bg-gray-100"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div key={cat.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{cat.nombre}</p>
                  {cat.descripcion && (
                    <p className="text-xs text-gray-500 truncate">{cat.descripcion}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(cat)}
                    className="grid h-7 w-7 place-items-center rounded-btn text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(cat.id)}
                    disabled={deleteMut.isPending}
                    className="grid h-7 w-7 place-items-center rounded-btn text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </Section>
  );
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
interface Proveedor {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
}

function ProveedoresSection() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ nombre: "", contacto: "", telefono: "", email: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", contacto: "", telefono: "", email: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<{ data: Proveedor[] }>("/suppliers"),
  });
  const proveedores = data?.data ?? [];

  const createMut = useMutation({
    mutationFn: (body: typeof addForm) => api.post("/suppliers", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setAddOpen(false);
      setAddForm({ nombre: "", contacto: "", telefono: "", email: "" });
      toast.success("Proveedor creado");
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "Error al crear"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<typeof editForm> }) =>
      api.patch(`/suppliers/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setEditId(null);
      toast.success("Proveedor actualizado");
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "Error al actualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.info("Proveedor eliminado");
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "Error al eliminar"),
  });

  function startEdit(p: Proveedor) {
    setEditId(p.id);
    setEditForm({ nombre: p.nombre, contacto: p.contacto ?? "", telefono: p.telefono ?? "", email: "" });
    setAddOpen(false);
  }

  function saveAdd() {
    if (!addForm.nombre.trim()) return;
    createMut.mutate({
      nombre: addForm.nombre.trim(),
      contacto: addForm.contacto.trim() || "",
      telefono: addForm.telefono.trim() || "",
      email: addForm.email.trim() || "",
    });
  }

  function saveEdit() {
    if (!editId || !editForm.nombre.trim()) return;
    updateMut.mutate({
      id: editId,
      body: {
        nombre: editForm.nombre.trim(),
        contacto: editForm.contacto.trim() || undefined,
        telefono: editForm.telefono.trim() || undefined,
        email: editForm.email.trim() || undefined,
      },
    });
  }

  const inputCls = cn(
    "h-9 px-3 border rounded-btn text-sm bg-white",
    "border-[hsl(var(--border))] focus:outline-none focus:ring-2",
    "focus:ring-[hsl(var(--primary))] focus:border-transparent",
  );

  return (
    <Section
      icon={Truck}
      title="Proveedores"
      description="Registra los proveedores disponibles para asignarlos en el ingreso de lotes"
    >
      <div className="px-5 py-3 border-b border-gray-50 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setAddOpen(true); setEditId(null); }}
        >
          <Plus size={13} />
          Nuevo proveedor
        </Button>
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="px-5 py-4 bg-gray-50/60 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input
              label="Nombre *"
              value={addForm.nombre}
              onChange={(e) => setAddForm((f) => ({ ...f, nombre: e.target.value }))}
              autoFocus
            />
            <Input
              label="Contacto"
              value={addForm.contacto}
              onChange={(e) => setAddForm((f) => ({ ...f, contacto: e.target.value }))}
            />
            <Input
              label="Teléfono"
              value={addForm.telefono}
              onChange={(e) => setAddForm((f) => ({ ...f, telefono: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="primary"
              onClick={saveAdd}
              loading={createMut.isPending}
              disabled={!addForm.nombre.trim()}
            >
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">Cargando...</p>
      ) : proveedores.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">Sin proveedores registrados</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {proveedores.map((p) =>
            editId === p.id ? (
              <div key={p.id} className="px-5 py-3 bg-gray-50/60">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <input
                    value={editForm.nombre}
                    onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                    placeholder="Nombre *"
                    autoFocus
                    className={cn(inputCls, "w-full")}
                  />
                  <input
                    value={editForm.contacto}
                    onChange={(e) => setEditForm((f) => ({ ...f, contacto: e.target.value }))}
                    placeholder="Contacto"
                    className={cn(inputCls, "w-full")}
                  />
                  <input
                    value={editForm.telefono}
                    onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                    placeholder="Teléfono"
                    className={cn(inputCls, "w-full")}
                  />
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Email"
                    className={cn(inputCls, "w-full")}
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={saveEdit}
                    disabled={updateMut.isPending}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-btn bg-[hsl(var(--primary))] text-white text-xs font-medium hover:bg-[hsl(var(--primary)/0.9)] disabled:opacity-50"
                  >
                    <Check size={12} /> Guardar
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-btn border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50"
                  >
                    <X size={12} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                  {(p.contacto || p.telefono) && (
                    <p className="text-xs text-gray-500 truncate">
                      {[p.contacto, p.telefono].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(p)}
                    className="grid h-7 w-7 place-items-center rounded-btn text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(p.id)}
                    disabled={deleteMut.isPending}
                    className="grid h-7 w-7 place-items-center rounded-btn text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </Section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TAB_TRIGGER =
  "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors " +
  "data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:text-[hsl(var(--primary))] " +
  "border-transparent text-gray-500 hover:text-gray-700";

export default function Configuracion() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: () => api.get<{ data: SysConfig }>("/config"),
  });

  const patchMut = useMutation({
    mutationFn: (patch: Partial<SysConfig>) => api.patch<{ data: SysConfig }>("/config", patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["config"] });
      const prev = qc.getQueryData<{ data: SysConfig }>(["config"]);
      qc.setQueryData(["config"], (old: { data: SysConfig } | undefined) =>
        old ? { data: { ...old.data, ...patch } } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["config"], ctx?.prev);
      toast.error("Error al guardar la configuración");
    },
    onSuccess: (res) => {
      qc.setQueryData(["config"], res);
      toast.success("Configuración guardada");
    },
  });

  const config = data?.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Configuración</h1>
        <p className="text-xs text-gray-500 mt-0.5">Administra alertas, autorizaciones, categorías y proveedores</p>
      </div>

      <Tabs.Root defaultValue="alertas">
        <div className="bg-white rounded-card shadow-sm border border-[hsl(var(--border))] mb-5">
          <Tabs.List className="flex gap-0 px-4 border-b border-[hsl(var(--border))]">
            <Tabs.Trigger value="alertas" className={TAB_TRIGGER}>
              Alertas
            </Tabs.Trigger>
            <Tabs.Trigger value="autorizaciones" className={TAB_TRIGGER}>
              Autorizaciones
            </Tabs.Trigger>
            <Tabs.Trigger value="categorias" className={TAB_TRIGGER}>
              Categorías
            </Tabs.Trigger>
            <Tabs.Trigger value="proveedores" className={TAB_TRIGGER}>
              Proveedores
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="alertas" className="p-5">
            {isLoading || !config ? (
              <p className="py-10 text-center text-sm text-gray-400">Cargando...</p>
            ) : (
              <AlertasSection config={config} onPatch={(p) => patchMut.mutate(p)} />
            )}
          </Tabs.Content>

          <Tabs.Content value="autorizaciones" className="p-5">
            {isLoading || !config ? (
              <p className="py-10 text-center text-sm text-gray-400">Cargando...</p>
            ) : (
              <AutorizacionesSection config={config} onPatch={(p) => patchMut.mutate(p)} />
            )}
          </Tabs.Content>

          <Tabs.Content value="categorias" className="p-5">
            <CategoriasSection />
          </Tabs.Content>

          <Tabs.Content value="proveedores" className="p-5">
            <ProveedoresSection />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
