import { cn } from "@/lib/utils";

type Variant = "success" | "critical" | "warning" | "info" | "neutral";

const VARIANTS: Record<Variant, string> = {
  success: "bg-green-100 text-green-800",
  critical: "bg-red-100 text-red-800",
  warning: "bg-yellow-100 text-yellow-800",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-600",
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
        "inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap",
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
  if (tipo === "INGRESO") return <StatusChip variant="success" label="INGRESO" />;
  if (tipo === "DESPACHO") return <StatusChip variant="info" label="DESPACHO" />;
  if (tipo === "DESPACHO_PENDIENTE") return <StatusChip variant="warning" label="PENDIENTE" />;
  return <StatusChip variant="neutral" label={tipo} />;
}
