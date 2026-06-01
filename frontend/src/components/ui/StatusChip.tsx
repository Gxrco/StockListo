import { cn } from "@/lib/utils";

type Variant = "success" | "dispatch" | "critical" | "warning" | "info" | "neutral" | "pending";

const VARIANTS: Record<Variant, string> = {
  success: "bg-green-100 text-green-700",
  dispatch: "bg-green-800 text-white",
  critical: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-gray-100 text-gray-500",
  pending: "bg-gray-100 text-gray-500",
};

interface Props {
  variant: Variant;
  label: string;
  className?: string;
}

export function StatusChip({ variant, label, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
        VARIANTS[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function stockStatusChip(stock: number, minimo: number) {
  if (stock === 0) return <StatusChip variant="critical" label="Sin stock" />;
  if (stock <= minimo) return <StatusChip variant="warning" label="Bajo stock" />;
  return <StatusChip variant="success" label="Normal" />;
}

export function tipoMovimientoChip(tipo: string) {
  if (tipo === "INGRESO") return <StatusChip variant="success" label="Ingreso" />;
  if (tipo === "DESPACHO") return <StatusChip variant="dispatch" label="Despacho" />;
  if (tipo === "DESPACHO_PENDIENTE" || tipo === "INGRESO_PENDIENTE")
    return <StatusChip variant="pending" label="Pendiente" />;
  return <StatusChip variant="neutral" label={tipo} />;
}
