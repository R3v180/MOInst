"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Mapas de etiquetas/colores por estado (un único punto de verdad)

const SALES_QUOTE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Borrador", cls: "bg-muted text-muted-foreground" },
  SENT: { label: "Enviado", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  ACCEPTED: { label: "Aceptado", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  REJECTED: { label: "Rechazado", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  EXPIRED: { label: "Caducado", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
};

const SALE_ORDER: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendiente", cls: "bg-muted text-muted-foreground" },
  IN_PROGRESS: { label: "En curso", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  INSTALLED: { label: "Instalado", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  CLOSED: { label: "Cerrado", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
};

const PURCHASE_QUOTE: Record<string, { label: string; cls: string }> = {
  RECEIVED: { label: "Recibido", cls: "bg-muted text-muted-foreground" },
  ACCEPTED: { label: "Aceptado", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  DISCARDED: { label: "Descartado", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const PURCHASE_ORDER: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendiente", cls: "bg-muted text-muted-foreground" },
  PARTIAL_RECEIVED: { label: "Parcial", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  RECEIVED: { label: "Recibido", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
};

const INCIDENT: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Abierta", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  IN_RESOLUTION: { label: "En resolución", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  CLOSED: { label: "Cerrada", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
};

const INSTALLATION: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Activa", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  REMOVED: { label: "Retirada", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  REPLACED: { label: "Sustituida", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

const APPOINTMENT: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendiente", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  DONE: { label: "Realizada", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  CANCELLED: { label: "Cancelada", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
};

const PAYMENT: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Cobrado", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  PENDING: { label: "Pendiente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
};

export function StatusBadge({ kind, value }: { kind: "saleQuote" | "saleOrder" | "purchaseQuote" | "purchaseOrder" | "incident" | "installation" | "appointment" | "payment"; value: string }) {
  const map = {
    saleQuote: SALES_QUOTE,
    saleOrder: SALE_ORDER,
    purchaseQuote: PURCHASE_QUOTE,
    purchaseOrder: PURCHASE_ORDER,
    incident: INCIDENT,
    installation: INSTALLATION,
    appointment: APPOINTMENT,
    payment: PAYMENT,
  }[kind];
  const info = map[value] ?? { label: value, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", info.cls)}>
      {info.label}
    </span>
  );
}

export const STATUS_LABELS = {
  saleQuote: SALES_QUOTE,
  saleOrder: SALE_ORDER,
  purchaseQuote: PURCHASE_QUOTE,
  purchaseOrder: PURCHASE_ORDER,
  incident: INCIDENT,
  installation: INSTALLATION,
  appointment: APPOINTMENT,
  payment: PAYMENT,
};
