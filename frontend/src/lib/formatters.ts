const CURRENCY_SYMBOL = import.meta.env.VITE_CURRENCY_SYMBOL ?? "Q";

export function currency(amount: number | string, symbol = CURRENCY_SYMBOL): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${symbol} ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-GT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
