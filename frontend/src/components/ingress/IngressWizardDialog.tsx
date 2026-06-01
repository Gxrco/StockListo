/**
 * 4-step ingress wizard:
 *  Step 1 — Search / select product (or create new inline)
 *  Step 2 — Lot details (supplier, cajas, unidades/caja, factura, vencimiento)
 *  Step 3 — Costs (toggle total ↔ unitario, live preview)
 *  Step 4 — Confirmation summary → POST /stock-ingress
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronRight, Package } from "lucide-react";
import { Modal, ModalHeader, ModalBody } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { currency } from "@/lib/formatters";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

// ── Schemas ───────────────────────────────────────────────────────────────────

const step2Schema = z.object({
  proveedorId: z.string().optional(),
  cantidadCajas: z.coerce.number({ required_error: "Requerido" }).int().positive("Debe ser > 0"),
  unidadesPorCaja: z.coerce.number({ required_error: "Requerido" }).int().min(1, "Mínimo 1"),
  numeroFactura: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  descripcion: z.string().optional(),
});

const step3Schema = z.object({
  costMode: z.enum(["total", "unitario"]),
  costoTotal: z.coerce.number().optional(),
  costoUnitario: z.coerce.number().optional(),
}).refine(
  (d) => (d.costMode === "total" ? (d.costoTotal ?? 0) > 0 : (d.costoUnitario ?? 0) > 0),
  { message: "Ingresa un costo válido mayor a 0" },
);

type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

// ── Wizard state ──────────────────────────────────────────────────────────────

interface WizardData {
  producto: { id: string; nombre: string; codigo: string; unidadBase: string } | null;
  step2: Step2Data | null;
  step3: Step3Data | null;
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  const labels = ["Producto", "Lote", "Costos", "Confirmar"];

  return (
    <div className="flex min-w-[360px] items-start justify-center">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex flex-1 items-start last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className={`grid h-3 w-3 place-items-center rounded-full border-2 transition-colors ${
                i <= current
                  ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]"
                  : "border-gray-300 bg-white"
              }`}
            />
            <span className={`text-[10px] font-medium ${i === current ? "text-gray-900" : "text-gray-400"}`}>
              {labels[i] ?? `Paso ${i + 1}`}
            </span>
          </div>
          {i < total - 1 && (
            <span className={`mt-1.5 h-px flex-1 ${i < current ? "bg-[hsl(var(--accent))]" : "bg-gray-300"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Product search ────────────────────────────────────────────────────

function Step1({
  onSelect,
}: {
  onSelect: (p: WizardData["producto"]) => void;
}) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const { data, isLoading } = useQuery({
    queryKey: ["products", "search", debouncedQ],
    queryFn: () => api.get<any>(`/products?status=active&q=${encodeURIComponent(debouncedQ)}&perPage=10`),
    staleTime: 5_000,
  });

  const products = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Buscar producto</h2>
        <p className="text-xs text-gray-400 mt-0.5">Selecciona el producto al que deseas agregar un lote</p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre o código del producto..."
          className="w-full h-10 pl-9 pr-3 border border-gray-200 rounded-(--radius-btn) text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="border border-gray-200 rounded-(--radius-card) divide-y divide-gray-50 max-h-64 overflow-y-auto">
        {isLoading ? (
          <p className="px-4 py-3 text-sm text-gray-400">Buscando...</p>
        ) : products.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400">
            {debouncedQ ? `Sin resultados para "${debouncedQ}"` : "Sin productos activos"}
          </p>
        ) : (
          products.map((p: any) => (
            <button
              key={p.id}
              onClick={() =>
                onSelect({
                  id: p.id,
                  nombre: p.nombre,
                  codigo: p.codigo,
                  unidadBase: p.unidadBase ?? "unidad",
                })
              }
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="p-1.5 bg-gray-100 rounded-lg">
                <Package size={14} className="text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                <p className="text-xs text-gray-400">
                  {p.codigo} · {p.categoria?.nombre ?? "Sin categoría"} · Stock: {p.stockActual}
                </p>
              </div>
              <ChevronRight size={14} className="text-gray-300 shrink-0" />
            </button>
          ))
        )}
      </div>

      {!q && (
        <p className="text-xs text-gray-400">
          Mostrando los primeros 10 productos activos. Usa la búsqueda para filtrar por nombre o código.
        </p>
      )}
    </div>
  );
}

// ── Step 2: Lot details ───────────────────────────────────────────────────────

function Step2({
  producto,
  onNext,
  onBack,
}: {
  producto: NonNullable<WizardData["producto"]>;
  onNext: (data: Step2Data) => void;
  onBack: () => void;
}) {
  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<any>("/suppliers"),
  });
  const suppliers = suppliersData?.data ?? [];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step2Data>({ resolver: zodResolver(step2Schema), defaultValues: { unidadesPorCaja: 1 } });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Detalles del lote</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Ingresando a: <span className="font-medium text-gray-600">{producto.nombre}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Proveedor</label>
          <select
            {...register("proveedorId")}
            className="w-full h-10 px-3 border border-gray-200 rounded-(--radius-btn) text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <Input
          label="N° Factura"
          placeholder="FAC-001"
          {...register("numeroFactura")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label={`Cantidad (${producto.unidadBase === "caja" ? "cajas" : "cajas / unidades"})`}
          type="number"
          min={1}
          placeholder="10"
          error={errors.cantidadCajas?.message}
          {...register("cantidadCajas")}
        />
        <Input
          label={`Unidades por ${producto.unidadBase === "caja" ? "caja" : "presentación"}`}
          type="number"
          min={1}
          placeholder="25"
          error={errors.unidadesPorCaja?.message}
          hint="Ej: 1 si se ingresa por unidad"
          {...register("unidadesPorCaja")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Fecha de vencimiento"
          type="date"
          error={errors.fechaVencimiento?.message}
          {...register("fechaVencimiento")}
        />
        <Input
          label="Descripción (opcional)"
          placeholder="Notas del lote..."
          {...register("descripcion")}
        />
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>Atrás</Button>
        <Button type="submit" variant="primary">Continuar</Button>
      </div>
    </form>
  );
}

// ── Step 3: Cost entry ────────────────────────────────────────────────────────

function Step3({
  step2,
  onNext,
  onBack,
}: {
  step2: Step2Data;
  onNext: (data: Step3Data) => void;
  onBack: () => void;
}) {
  const totalUnidades = step2.cantidadCajas * step2.unidadesPorCaja;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: { costMode: "total" },
  });

  const costMode = watch("costMode");
  const costoTotal = watch("costoTotal") ?? 0;
  const costoUnitario = watch("costoUnitario") ?? 0;

  const preview =
    costMode === "total"
      ? { unitario: totalUnidades > 0 ? costoTotal / totalUnidades : 0, total: costoTotal }
      : { unitario: costoUnitario, total: costoUnitario * totalUnidades };

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Costos del lote</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {totalUnidades} unidades totales ({step2.cantidadCajas} × {step2.unidadesPorCaja})
        </p>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-(--radius-btn) w-fit">
        {(["total", "unitario"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setValue("costMode", mode)}
            className={`px-4 py-1.5 text-xs font-medium rounded-[calc(var(--radius-btn)-2px)] transition-colors ${
              costMode === mode
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {mode === "total" ? "Costo total" : "Costo unitario"}
          </button>
        ))}
      </div>

      {costMode === "total" ? (
        <Input
          label="Costo total del lote (Q)"
          type="number"
          step="0.01"
          min={0.01}
          placeholder="500.00"
          error={errors.costoTotal?.message ?? errors.root?.message}
          {...register("costoTotal")}
        />
      ) : (
        <Input
          label="Costo por unidad (Q)"
          type="number"
          step="0.01"
          min={0.01}
          placeholder="20.00"
          error={errors.costoUnitario?.message ?? errors.root?.message}
          {...register("costoUnitario")}
        />
      )}

      {/* Live preview */}
      {(preview.total > 0 || preview.unitario > 0) && (
        <div className="bg-[hsl(var(--primary)/0.04)] border border-[hsl(var(--primary)/0.12)] rounded-(--radius-btn) p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] uppercase text-gray-400 font-semibold tracking-wide">Costo unitario</p>
            <p className="text-xl font-bold text-[hsl(var(--primary))] mt-1">
              {currency(preview.unitario)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-gray-400 font-semibold tracking-wide">Costo total</p>
            <p className="text-xl font-bold text-[hsl(var(--primary))] mt-1">
              {currency(preview.total)}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>Atrás</Button>
        <Button type="submit" variant="primary">Revisar</Button>
      </div>
    </form>
  );
}

// ── Step 4: Confirmation ──────────────────────────────────────────────────────

function Step4({
  wizard,
  onConfirm,
  onBack,
  isLoading,
}: {
  wizard: { producto: NonNullable<WizardData["producto"]>; step2: Step2Data; step3: Step3Data };
  onConfirm: () => void;
  onBack: () => void;
  isLoading: boolean;
}) {
  const totalUnidades = wizard.step2.cantidadCajas * wizard.step2.unidadesPorCaja;
  const costoTotal =
    wizard.step3.costMode === "total"
      ? (wizard.step3.costoTotal ?? 0)
      : (wizard.step3.costoUnitario ?? 0) * totalUnidades;
  const costoUnitario =
    wizard.step3.costMode === "unitario"
      ? (wizard.step3.costoUnitario ?? 0)
      : costoTotal / totalUnidades;

  const rows = [
    { label: "Producto", value: wizard.producto.nombre },
    { label: "Código", value: wizard.producto.codigo },
    { label: "Cajas", value: String(wizard.step2.cantidadCajas) },
    { label: "Unidades/caja", value: String(wizard.step2.unidadesPorCaja) },
    { label: "Total unidades", value: String(totalUnidades) },
    { label: "Factura", value: wizard.step2.numeroFactura ?? "—" },
    { label: "Vencimiento", value: wizard.step2.fechaVencimiento ?? "—" },
    { label: "Costo unitario", value: currency(costoUnitario) },
    { label: "Costo total", value: currency(costoTotal) },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Confirmar ingreso</h2>
        <p className="text-xs text-gray-400 mt-0.5">Revisa los datos antes de confirmar</p>
      </div>

      <div className="border border-gray-100 rounded-(--radius-card) divide-y divide-gray-50">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-800">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isLoading}>
          Atrás
        </Button>
        <Button variant="accent" onClick={onConfirm} loading={isLoading}>
          Confirmar ingreso
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function IngressWizardDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [wizard, setWizard] = useState<WizardData>({ producto: null, step2: null, step3: null });

  const handleClose = () => {
    onClose();
    // Reset after close animation
    setTimeout(() => { setStep(0); setWizard({ produto: null, step2: null, step3: null } as any); }, 300);
  };

  const mutation = useMutation({
    mutationFn: (payload: object) => api.post("/stock-ingress", payload),
    onSuccess: () => {
      toast.success("Ingreso registrado exitosamente");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      handleClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) toast.error(e.problem.detail);
      else toast.error("Error al registrar el ingreso");
    },
  });

  const handleConfirm = () => {
    const { producto, step2, step3 } = wizard;
    if (!producto || !step2 || !step3) return;

    const payload: Record<string, unknown> = {
      productoId: producto.id,
      cantidadCajas: step2.cantidadCajas,
      unidadesPorCaja: step2.unidadesPorCaja,
      numeroFactura: step2.numeroFactura || undefined,
      fechaVencimiento: step2.fechaVencimiento || undefined,
      descripcion: step2.descripcion || undefined,
      proveedorId: step2.proveedorId || undefined,
    };
    if (step3.costMode === "total") {
      payload.costoTotal = step3.costoTotal;
    } else {
      payload.costoUnitario = step3.costoUnitario;
    }
    mutation.mutate(payload);
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalHeader>
        <div className="flex items-center justify-between pr-8">
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Nuevo ingreso de producto
          </span>
          <StepDots current={step} total={4} />
        </div>
      </ModalHeader>

      <ModalBody>
        {step === 0 && (
          <Step1
            onSelect={(p) => {
              setWizard((w) => ({ ...w, producto: p }));
              setStep(1);
            }}
          />
        )}
        {step === 1 && wizard.producto && (
          <Step2
            producto={wizard.producto}
            onNext={(data) => { setWizard((w) => ({ ...w, step2: data })); setStep(2); }}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && wizard.step2 && (
          <Step3
            step2={wizard.step2}
            onNext={(data) => { setWizard((w) => ({ ...w, step3: data })); setStep(3); }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && wizard.producto && wizard.step2 && wizard.step3 && (
          <Step4
            wizard={{ producto: wizard.producto, step2: wizard.step2, step3: wizard.step3 }}
            onConfirm={handleConfirm}
            onBack={() => setStep(2)}
            isLoading={mutation.isPending}
          />
        )}
      </ModalBody>
    </Modal>
  );
}
