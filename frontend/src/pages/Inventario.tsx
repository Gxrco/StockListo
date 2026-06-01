import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Plus, Pencil, PackageMinus, ArrowDownToLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { currency } from "@/lib/formatters";
import { toast } from "@/components/ui/Toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { IngressWizardDialog } from "@/components/ingress/IngressWizardDialog";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "low", label: "Bajo stock" },
  { value: "out", label: "Sin stock" },
];

const UNIDADES = ["unidad", "caja", "bolsa", "paquete", "litro", "kg", "par"];

const productSchema = z.object({
  codigo: z.string().min(1, "Requerido").max(60),
  nombre: z.string().min(1, "Requerido").max(200),
  idCategoria: z.string().uuid("Selecciona una categoría"),
  unidadBase: z.string().min(1),
  stockMinimo: z.number().int().min(0),
  descripcion: z.string().optional(),
});
type ProductForm = z.infer<typeof productSchema>;

function StatusChip({ stock, minimo }: { stock: number; minimo: number }) {
  if (stock === 0)
    return <span className="bg-red-100 text-red-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">Sin stock</span>;
  if (stock <= minimo)
    return <span className="bg-yellow-100 text-yellow-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">Bajo stock</span>;
  return <span className="bg-green-100 text-green-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">Normal</span>;
}

function FieldRow({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = "w-full h-9 px-3 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]";

export default function Inventario() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q.trim(), 300);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showIngress, setShowIngress] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["products", debouncedQ, status, page],
    queryFn: () => {
      const params = new URLSearchParams({
        q: debouncedQ,
        page: String(page),
        perPage: "50",
      });
      if (status) params.set("status", status);
      return api.get<any>(`/products?${params.toString()}`);
    },
    staleTime: 15_000,
  });
  const { data: catData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<any>("/categories"),
  });

  const products: any[] = data?.data ?? [];
  const categories: any[] = catData?.data ?? [];
  const meta = data?.meta;

  const createForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { unidadBase: "unidad", stockMinimo: 0 },
  });
  const editForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { unidadBase: "unidad", stockMinimo: 0 },
  });

  const createMut = useMutation({
    mutationFn: (d: ProductForm) => api.post("/products", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto creado");
      setShowCreate(false);
      createForm.reset();
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "No se pudo crear el producto"),
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductForm> }) =>
      api.patch(`/products/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto actualizado");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "No se pudo actualizar"),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto desactivado");
    },
    onError: (e: any) => toast.error(e?.problem?.detail ?? "No se pudo desactivar"),
  });

  function openEdit(p: any) {
    setEditing(p);
    editForm.reset({
      codigo: p.codigo,
      nombre: p.nombre,
      idCategoria: p.idCategoria ?? p.categoria?.id ?? "",
      unidadBase: p.unidadBase ?? "unidad",
      stockMinimo: p.stockMinimo ?? 0,
      descripcion: p.descripcion ?? "",
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800">Inventario</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white text-sm font-medium px-4 py-2 rounded-btn transition-colors"
          >
            <Plus size={15} />
            Nuevo producto
          </button>
          <button
            onClick={() => setShowIngress(true)}
            className="flex items-center gap-2 bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.9)] text-[hsl(var(--primary))] text-sm font-medium px-4 py-2 rounded-btn transition-colors"
          >
            <ArrowDownToLine size={15} />
            Ingreso
          </button>
        </div>
      </div>

      <IngressWizardDialog open={showIngress} onClose={() => setShowIngress(false)} />

      {/* Filters */}
      <div className="bg-white rounded-card p-4 shadow-sm border border-gray-100 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre o código..."
            className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatus(opt.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-btn transition-colors ${
                status === opt.value
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Código", "Nombre", "Categoría", "Unidad", "Stock", "Costo prom.", "Estado", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-medium text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">Cargando...</td></tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <p className="text-sm text-gray-400">Sin productos</p>
                  <button onClick={() => setShowCreate(true)} className="mt-2 text-xs text-[hsl(var(--primary))] hover:underline">
                    Crear el primero
                  </button>
                </td>
              </tr>
            ) : products.map((p: any) => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-gray-500">{p.codigo}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{p.nombre}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.categoria?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.unidadBase}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-800">{p.stockActual}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{currency(p.costoPromedioPonderado ?? 0)}</td>
                <td className="px-4 py-3"><StatusChip stock={p.stockActual} minimo={p.stockMinimo} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => navigate(`/kardex/${p.id}`)}
                      className="text-xs text-[hsl(var(--primary))] hover:underline font-medium px-2"
                    >
                      Kardex
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 text-gray-400 hover:text-[hsl(var(--primary))] rounded hover:bg-gray-100 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    {p.stockActual === 0 && p.activo && (
                      <button
                        onClick={() => deactivateMut.mutate(p.id)}
                        disabled={deactivateMut.isPending}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                        title="Desactivar"
                      >
                        <PackageMinus size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {meta && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">{meta.total} productos</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="text-xs px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                Anterior
              </button>
              <span className="text-xs text-gray-400 self-center">pág. {page} / {meta.pages}</span>
              <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}
                className="text-xs px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); createForm.reset(); }}>
        <ModalHeader>
          <h2 className="text-base font-semibold text-gray-800">Nuevo producto</h2>
          <p className="text-xs text-gray-400 mt-0.5">Define las características del producto</p>
        </ModalHeader>
        <form onSubmit={createForm.handleSubmit((d) => createMut.mutate(d))}>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Código" error={createForm.formState.errors.codigo?.message}>
                  <input {...createForm.register("codigo")} placeholder="ej. PROD-001" className={inputCls} />
                </FieldRow>
                <FieldRow label="Unidad base" error={createForm.formState.errors.unidadBase?.message}>
                  <select {...createForm.register("unidadBase")} className={`${inputCls} bg-white`}>
                    {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </FieldRow>
              </div>
              <FieldRow label="Nombre del producto" error={createForm.formState.errors.nombre?.message}>
                <input {...createForm.register("nombre")} placeholder="ej. Agua pura 500ml" className={inputCls} />
              </FieldRow>
              <FieldRow label="Categoría" error={createForm.formState.errors.idCategoria?.message}>
                <select {...createForm.register("idCategoria")} className={`${inputCls} bg-white`}>
                  <option value="">Seleccionar categoría...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Stock mínimo (alerta)" error={createForm.formState.errors.stockMinimo?.message}>
                <input {...createForm.register("stockMinimo", { valueAsNumber: true })}
                  type="number" min="0" className={inputCls} />
              </FieldRow>
              <FieldRow label="Descripción (opcional)">
                <textarea {...createForm.register("descripcion")}
                  rows={2} placeholder="Notas adicionales..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none" />
              </FieldRow>
            </div>
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => { setShowCreate(false); createForm.reset(); }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-btn transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white rounded-btn transition-colors disabled:opacity-50">
              {createMut.isPending ? "Creando..." : "Crear producto"}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)}>
        <ModalHeader>
          <h2 className="text-base font-semibold text-gray-800">Editar: {editing?.nombre ?? ""}</h2>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{editing?.codigo}</p>
        </ModalHeader>
        <form onSubmit={editForm.handleSubmit((d) => editMut.mutate({ id: editing.id, data: d }))}>
          <ModalBody>
            <div className="space-y-4">
              <FieldRow label="Nombre" error={editForm.formState.errors.nombre?.message}>
                <input {...editForm.register("nombre")} className={inputCls} />
              </FieldRow>
              <FieldRow label="Categoría" error={editForm.formState.errors.idCategoria?.message}>
                <select {...editForm.register("idCategoria")} className={`${inputCls} bg-white`}>
                  <option value="">Seleccionar...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </FieldRow>
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Unidad base">
                  <select {...editForm.register("unidadBase")} className={`${inputCls} bg-white`}>
                    {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Stock mínimo">
                  <input {...editForm.register("stockMinimo", { valueAsNumber: true })}
                    type="number" min="0" className={inputCls} />
                </FieldRow>
              </div>
              <FieldRow label="Descripción">
                <textarea {...editForm.register("descripcion")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none" />
              </FieldRow>
            </div>
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setEditing(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-btn transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={editMut.isPending}
              className="px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white rounded-btn transition-colors disabled:opacity-50">
              {editMut.isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
