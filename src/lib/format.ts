// Utilidades de formato (cliente y servidor)

export function formatCurrency(n: number | null | undefined): string {
  const v = n ?? 0;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const diff = date.getTime() - Date.now();
  const days = Math.round(diff / 86400000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  return rtf.format(months, "month");
}

export function daysUntil(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export function fullAddress(c: {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressFloor?: string | null;
  postalCode?: string | null;
  city?: string | null;
  province?: string | null;
} | null | undefined): string {
  if (!c) return "—";
  const parts = [
    [c.addressStreet, c.addressNumber].filter(Boolean).join(" "),
    c.addressFloor,
    [c.postalCode, c.city].filter(Boolean).join(" "),
    c.province,
  ].filter(Boolean);
  return parts.join(", ") || "—";
}

export function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((s) => s.charAt(0).toUpperCase()).join("");
}
