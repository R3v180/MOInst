"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { fullAddress, formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CalendarRange,
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  User as UserIcon,
  Loader2,
  FileText,
  Wrench,
  Siren,
  ShieldCheck,
  X,
  Check,
  Search,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";

type AppointmentType =
  | "QUOTE_VISIT"
  | "INSTALLATION"
  | "MAINTENANCE"
  | "INCIDENT"
  | "OTHER";
type AppointmentStatus = "PENDING" | "DONE" | "CANCELLED";

const TYPE_META: Record<
  AppointmentType,
  { label: string; icon: typeof FileText; cls: string }
> = {
  QUOTE_VISIT: {
    label: "Visita presu.",
    icon: FileText,
    cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  },
  INSTALLATION: {
    label: "Instalación",
    icon: Wrench,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  MAINTENANCE: {
    label: "Mantenim.",
    icon: ShieldCheck,
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  INCIDENT: {
    label: "Incidencia",
    icon: Siren,
    cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  OTHER: {
    label: "Otra",
    icon: CalendarIcon,
    cls: "bg-muted text-muted-foreground",
  },
};

const TYPE_OPTIONS: { value: AppointmentType; label: string }[] = [
  { value: "QUOTE_VISIT", label: "Visita presupuestar" },
  { value: "INSTALLATION", label: "Instalación" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "INCIDENT", label: "Incidencia / garantía" },
  { value: "OTHER", label: "Otra" },
];

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Date helpers (local, no timezone surprises) ────────────────────────────
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days back to Monday
  x.setDate(x.getDate() - diff);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function addHours(d: Date, n: number) {
  const x = new Date(d);
  x.setHours(x.getHours() + n);
  return x;
}
function fmtDateOnly(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtTimeOnly(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// For datetime-local input (local time, no TZ)
function toLocalDateTimeInput(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(
    dt.getDate()
  )}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
// From datetime-local value to ISO string
function fromLocalDateTimeInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function isToday(d: Date) {
  return sameDay(d, new Date());
}

// ─────────────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────────────
export function AgendaView() {
  const { setView } = useAppStore();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"today" | "week" | "month">("today");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [assignedToId, setAssignedToId] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Date range to fetch based on mode + selectedDate
  const range = useMemo(() => {
    if (mode === "today") {
      return { from: startOfDay(selectedDate), to: endOfDay(selectedDate) };
    }
    if (mode === "week") {
      const from = startOfWeek(selectedDate);
      return { from, to: addDays(from, 7) };
    }
    return { from: startOfMonth(selectedDate), to: endOfMonth(selectedDate) };
  }, [mode, selectedDate]);

  // Users (for "asignado a" filter)
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
  });
  const users = usersData?.items ?? [];

  // Appointments query
  const { data, isLoading } = useQuery({
    queryKey: [
      "appointments",
      mode,
      range.from.toISOString(),
      range.to.toISOString(),
      assignedToId,
    ],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("startAtFrom", range.from.toISOString());
      p.set("startAtTo", range.to.toISOString());
      if (assignedToId !== "all") p.set("assignedToId", assignedToId);
      const r = await fetch(`/api/appointments?${p.toString()}`);
      if (!r.ok) throw new Error("Error al cargar citas");
      return r.json();
    },
  });
  const items: any[] = data?.items ?? [];

  // Status change mutation (used in today list)
  const statusMut = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: AppointmentStatus;
    }) => {
      const r = await fetch(`/api/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error");
      }
      return r.json();
    },
    onSuccess: (_d, vars) => {
      toast({
        title:
          vars.status === "DONE"
            ? "Cita marcada como realizada"
            : vars.status === "CANCELLED"
              ? "Cita cancelada"
              : "Estado actualizado",
      });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (editing?.id === vars.id) setEditing(null);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Create / Update mutation (shared with form)
  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!payload.id;
      const url = isEdit
        ? `/api/appointments/${payload.id}`
        : "/api/appointments";
      const r = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al guardar la cita");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Cita guardada" });
      setShowNew(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Cita eliminada" });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Buckets per day (used in week & month views)
  const itemsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of items) {
      const d = new Date(a.startAt);
      const key = fmtDateOnly(d);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [items]);

  // Week array
  const weekDays = useMemo(() => {
    const from = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(from, i));
  }, [selectedDate]);

  // Month grid (with leading/trailing days to fill weeks)
  const monthGrid = useMemo(() => {
    const first = startOfMonth(selectedDate);
    const startWeekday = (first.getDay() + 6) % 7; // 0=Mon
    const lastDay = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      0
    ).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ date: addDays(first, i - startWeekday), inMonth: false });
    }
    for (let i = 1; i <= lastDay; i++) {
      cells.push({
        date: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i),
        inMonth: true,
      });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: addDays(last, 1), inMonth: false });
    }
    return cells;
  }, [selectedDate]);

  // Navigation handlers
  const goPrev = () => {
    if (mode === "today") setSelectedDate((d) => addDays(d, -1));
    else if (mode === "week") setSelectedDate((d) => addDays(d, -7));
    else setSelectedDate((d) => addMonths(d, -1));
  };
  const goNext = () => {
    if (mode === "today") setSelectedDate((d) => addDays(d, 1));
    else if (mode === "week") setSelectedDate((d) => addDays(d, 7));
    else setSelectedDate((d) => addMonths(d, 1));
  };
  const goToday = () => setSelectedDate(new Date());

  // Header label per mode
  const rangeLabel = useMemo(() => {
    if (mode === "today") {
      const d = selectedDate;
      const weekday = [
        "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
      ][d.getDay()];
      return `${weekday}, ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
    }
    if (mode === "week") {
      const from = startOfWeek(selectedDate);
      const to = addDays(from, 6);
      const sameMonth = from.getMonth() === to.getMonth();
      if (sameMonth) {
        return `${from.getDate()} – ${to.getDate()} ${MONTHS[from.getMonth()].toLowerCase()} ${from.getFullYear()}`;
      }
      return `${from.getDate()} ${MONTHS[from.getMonth()].toLowerCase()} – ${to.getDate()} ${MONTHS[to.getMonth()].toLowerCase()} ${from.getFullYear()}`;
    }
    return `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }, [mode, selectedDate]);

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Citas, visitas y trabajos programados"
        actions={
          <>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger className="w-full sm:w-56">
                <UserIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Todas las personas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las personas</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}{" "}
                    <span className="text-muted-foreground">· {u.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nueva cita
            </Button>
          </>
        }
      />

      {/* Mode selector + navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "today" | "week" | "month")}
        >
          <TabsList>
            <TabsTrigger value="today" className="gap-1">
              <CalendarDays className="w-4 h-4" /> Hoy
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-1">
              <CalendarRange className="w-4 h-4" /> Semana
            </TabsTrigger>
            <TabsTrigger value="month" className="gap-1">
              <CalendarIcon className="w-4 h-4" /> Mes
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} aria-label="Anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[10rem] text-center">
            {rangeLabel}
          </span>
          <Button variant="outline" size="sm" onClick={goNext} aria-label="Siguiente">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            {mode === "today" ? "Hoy" : mode === "week" ? "Esta semana" : "Este mes"}
          </Button>
        </div>
      </div>

      {/* ─── Today view ─── */}
      {mode === "today" && (
        <TodayList
          items={items.filter((a) =>
            sameDay(new Date(a.startAt), selectedDate)
          )}
          isLoading={isLoading}
          onEdit={setEditing}
          onStatus={(id, status) => statusMut.mutate({ id, status })}
          statusLoading={statusMut.isPending}
          onClientDetail={(id) => setView("client-detail", { id: id! })}
        />
      )}

      {/* ─── Week view ─── */}
      {mode === "week" && (
        <WeekGrid
          weekDays={weekDays}
          itemsByDay={itemsByDay}
          isLoading={isLoading}
          onEdit={setEditing}
          onDayClick={(d) => {
            setSelectedDate(d);
            setMode("today");
          }}
        />
      )}

      {/* ─── Month view ─── */}
      {mode === "month" && (
        <MonthGrid
          cells={monthGrid}
          itemsByDay={itemsByDay}
          currentDate={selectedDate}
          isLoading={isLoading}
          onEdit={setEditing}
          onDayClick={(d) => {
            setSelectedDate(d);
            setMode("today");
          }}
        />
      )}

      {/* Create / Edit dialog (key-remount to reset state when target changes) */}
      <AppointmentForm
        key={editing?.id ?? "new"}
        open={showNew || !!editing}
        initial={editing}
        onOpenChange={(v) => {
          if (!v) {
            setShowNew(false);
            setEditing(null);
          }
        }}
        onSubmit={(payload) => saveMut.mutate(payload)}
        loading={saveMut.isPending}
        onDelete={
          editing
            ? () => deleteMut.mutate(editing.id)
            : undefined
        }
        deleteLoading={deleteMut.isPending}
        onStatusChange={
          editing
            ? (status) =>
                statusMut.mutate({ id: editing.id, status })
            : undefined
        }
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Today list (also reused for selected day in other modes via switch)
// ─────────────────────────────────────────────────────────────────────────────
function TodayList({
  items,
  isLoading,
  onEdit,
  onStatus,
  statusLoading,
  onClientDetail,
}: {
  items: any[];
  isLoading: boolean;
  onEdit: (a: any) => void;
  onStatus: (id: string, status: AppointmentStatus) => void;
  statusLoading: boolean;
  onClientDetail: (id?: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando citas...
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="w-6 h-6" />}
        title="No hay citas este día"
        description="Programa una nueva cita para este día."
      />
    );
  }
  const sorted = [...items].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((a) => {
        const type = TYPE_META[a.type as AppointmentType];
        const TypeIcon = type.icon;
        const start = new Date(a.startAt);
        const end = new Date(start.getTime() + (a.durationMin ?? 60) * 60000);
        const address =
          a.address ||
          (a.client ? fullAddress(a.client) : "") ||
          "";
        const isPending = a.status === "PENDING";
        return (
          <Card key={a.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col gap-3">
              {/* Time + type + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-center shrink-0">
                    <div className="text-base font-bold leading-none">
                      {fmtTimeOnly(start)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {a.durationMin} min
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      type.cls
                    )}
                  >
                    <TypeIcon className="w-3 h-3" />
                    {type.label}
                  </span>
                </div>
                <StatusBadge kind="appointment" value={a.status} />
              </div>

              {/* Client (link to detail) */}
              {a.client && (
                <button
                  onClick={() => onClientDetail(a.clientId)}
                  className="text-left font-medium hover:text-primary truncate"
                >
                  {a.client.name}
                </button>
              )}
              {!a.client && a.notes && (
                <div className="font-medium text-sm">{a.notes}</div>
              )}

              {/* Address + Google Maps */}
              {address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-muted-foreground break-words">{address}</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 inline-flex items-center gap-1 text-primary hover:underline whitespace-nowrap"
                    >
                      Abrir en Google Maps
                      <MapPin className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Assigned to */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserIcon className="w-3.5 h-3.5" />
                {a.assignedTo?.name ?? "Sin asignar"}
              </div>

              {/* Time range */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {fmtTimeOnly(start)} – {fmtTimeOnly(end)}
              </div>

              {/* Links */}
              {(a.installation || a.saleOrder || a.saleQuote) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {a.installation && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <LinkIcon className="w-3 h-3" />
                      {[a.installation.brand, a.installation.model].filter(Boolean).join(" ") || a.installation.equipmentType}
                    </span>
                  )}
                  {a.saleOrder && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <LinkIcon className="w-3 h-3" />
                      {a.saleOrder.number}
                    </span>
                  )}
                  {a.saleQuote && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <LinkIcon className="w-3 h-3" />
                      {a.saleQuote.number}
                    </span>
                  )}
                </div>
              )}

              {/* Notes */}
              {a.notes && (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
                  {a.notes}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(a)}
                >
                  Ver / editar
                </Button>
                {isPending && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-700 dark:text-green-400"
                      onClick={() => onStatus(a.id, "DONE")}
                      disabled={statusLoading}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Realizada
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => onStatus(a.id, "CANCELLED")}
                      disabled={statusLoading}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Week grid (Mon–Sun)
// ─────────────────────────────────────────────────────────────────────────────
function WeekGrid({
  weekDays,
  itemsByDay,
  isLoading,
  onEdit,
  onDayClick,
}: {
  weekDays: Date[];
  itemsByDay: Record<string, any[]>;
  isLoading: boolean;
  onEdit: (a: any) => void;
  onDayClick: (d: Date) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
      {weekDays.map((day, i) => {
        const key = fmtDateOnly(day);
        const dayItems = itemsByDay[key] ?? [];
        const today = isToday(day);
        return (
          <div
            key={key}
            className={cn(
              "rounded-lg border border-border bg-card flex flex-col min-h-[140px]",
              today && "ring-2 ring-primary/40"
            )}
          >
            <button
              onClick={() => onDayClick(day)}
              className="flex items-center justify-between px-3 py-2 border-b border-border hover:bg-accent/40 text-left"
            >
              <div>
                <div className="text-xs text-muted-foreground">{WEEKDAYS[i]}</div>
                <div className={cn("text-sm font-semibold", today && "text-primary")}>
                  {day.getDate()}
                </div>
              </div>
              {dayItems.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold w-6 h-6">
                  {dayItems.length}
                </span>
              )}
            </button>
            <div className="p-2 space-y-1 flex-1 max-h-64 overflow-y-auto scroll-thin">
              {isLoading && dayItems.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  <Loader2 className="w-3 h-3 animate-spin inline" />
                </div>
              )}
              {!isLoading && dayItems.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  —
                </div>
              )}
              {dayItems
                .sort(
                  (a, b) =>
                    new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
                )
                .map((a) => {
                  const type = TYPE_META[a.type as AppointmentType];
                  return (
                    <button
                      key={a.id}
                      onClick={() => onEdit(a)}
                      className={cn(
                        "w-full text-left rounded-md px-2 py-1 text-xs hover:bg-accent transition-colors border border-transparent hover:border-border",
                        a.status === "DONE" && "opacity-60",
                        a.status === "CANCELLED" && "line-through opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[11px]">
                          {fmtTimeOnly(new Date(a.startAt))}
                        </span>
                        <span
                          className={cn(
                            "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                            a.status === "DONE"
                              ? "bg-green-500"
                              : a.status === "CANCELLED"
                                ? "bg-zinc-400"
                                : type.cls.split(" ")[0]
                          )}
                        />
                        <span className="truncate font-medium">
                          {a.client?.name ?? a.notes ?? "Cita"}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month grid (calendar cells)
// ─────────────────────────────────────────────────────────────────────────────
function MonthGrid({
  cells,
  itemsByDay,
  currentDate,
  isLoading,
  onEdit,
  onDayClick,
}: {
  cells: { date: Date; inMonth: boolean }[];
  itemsByDay: Record<string, any[]>;
  currentDate: Date;
  isLoading: boolean;
  onEdit: (a: any) => void;
  onDayClick: (d: Date) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-xs text-muted-foreground text-center py-2 font-medium"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const key = fmtDateOnly(cell.date);
          const dayItems = itemsByDay[key] ?? [];
          const today = isToday(cell.date);
          const isWeekend = idx % 7 >= 5;
          return (
            <div
              key={key + "-" + idx}
              className={cn(
                "min-h-[88px] sm:min-h-[112px] border-b border-r border-border p-1.5 flex flex-col gap-1",
                !cell.inMonth && "bg-muted/20",
                isWeekend && "bg-muted/10"
              )}
            >
              <button
                onClick={() => onDayClick(cell.date)}
                className="text-left self-start"
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center text-xs font-medium w-6 h-6 rounded-full",
                    today
                      ? "bg-primary text-primary-foreground"
                      : cell.inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60"
                  )}
                >
                  {cell.date.getDate()}
                </span>
              </button>
              {isLoading && dayItems.length === 0 && (
                <div className="text-[10px] text-muted-foreground">
                  <Loader2 className="w-2.5 h-2.5 animate-spin inline" />
                </div>
              )}
              <div className="space-y-0.5 flex-1 max-h-24 overflow-y-auto scroll-thin">
                {dayItems
                  .sort(
                    (a, b) =>
                      new Date(a.startAt).getTime() -
                      new Date(b.startAt).getTime()
                  )
                  .map((a) => {
                    const type = TYPE_META[a.type as AppointmentType];
                    return (
                      <button
                        key={a.id}
                        onClick={() => onEdit(a)}
                        className={cn(
                          "w-full text-left rounded px-1 py-0.5 text-[10px] hover:bg-accent truncate block",
                          a.status === "DONE" && "line-through opacity-60",
                          a.status === "CANCELLED" && "line-through opacity-40",
                          type.cls
                        )}
                        title={`${fmtTimeOnly(new Date(a.startAt))} · ${a.client?.name ?? a.notes ?? ""}`}
                      >
                        <span className="font-semibold">
                          {fmtTimeOnly(new Date(a.startAt))}
                        </span>{" "}
                        <span className="truncate">
                          {a.client?.name ?? a.notes ?? "Cita"}
                        </span>
                      </button>
                    );
                  })}
              </div>
              {dayItems.length > 0 && !isLoading && (
                <button
                  onClick={() => onDayClick(cell.date)}
                  className="text-[10px] text-muted-foreground hover:text-primary mt-auto text-left"
                >
                  {dayItems.length} cita{dayItems.length !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {/* Reference: currentDate hidden use for future checks */}
      <span className="sr-only">{currentDate.toISOString()}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Appointment create / edit form (Dialog)
// ─────────────────────────────────────────────────────────────────────────────
function AppointmentForm({
  open,
  onOpenChange,
  initial,
  onSubmit,
  loading,
  onDelete,
  deleteLoading,
  onStatusChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: any | null;
  onSubmit: (payload: any) => void;
  loading: boolean;
  onDelete?: () => void;
  deleteLoading: boolean;
  onStatusChange?: (status: AppointmentStatus) => void;
}) {
  // Initial form state — computed from initial when component mounts (Dialog remounts on open)
  const defaultStart = useMemo(() => {
    if (initial?.startAt) return toLocalDateTimeInput(initial.startAt);
    const next = addHours(new Date(), 1);
    next.setMinutes(0, 0, 0);
    return toLocalDateTimeInput(next);
  }, [initial]);

  const [d, setD] = useState<any>({
    type: initial?.type ?? "QUOTE_VISIT",
    startAt: defaultStart,
    durationMin: initial?.durationMin ?? 60,
    clientId: initial?.clientId ?? null,
    installationId: initial?.installationId ?? null,
    saleOrderId: initial?.saleOrderId ?? null,
    saleQuoteId: initial?.saleQuoteId ?? null,
    assignedToId: initial?.assignedToId ?? null,
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
    status: initial?.status ?? "PENDING",
  });
  const [clientOpen, setClientOpen] = useState(false);
  const [clientQ, setClientQ] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(
    initial?.client ?? null
  );
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }));

  // Users
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
  });
  const users = usersData?.items ?? [];

  // Clients (searchable, only when open)
  const { data: clientsData } = useQuery({
    queryKey: ["clients", "picker", clientQ],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (clientQ) p.set("q", clientQ);
      p.set("pageSize", "100");
      const r = await fetch(`/api/clients?${p.toString()}`);
      if (!r.ok) return { items: [] };
      return r.json();
    },
    enabled: open,
  });
  const clients = clientsData?.items ?? [];

  // Installations filtered by client
  const { data: installationsData } = useQuery({
    queryKey: ["installations", "picker", d.clientId],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("clientId", d.clientId);
      p.set("pageSize", "100");
      const r = await fetch(`/api/installations?${p.toString()}`);
      if (!r.ok) return { items: [] };
      return r.json();
    },
    enabled: open && !!d.clientId,
  });
  const installations = installationsData?.items ?? [];

  // Sale orders + quotes (for client)
  const { data: saleOrdersData } = useQuery({
    queryKey: ["sale-orders", "picker", d.clientId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (d.clientId) p.set("clientId", d.clientId);
      const r = await fetch(`/api/sale-orders?${p.toString()}`);
      if (!r.ok) return { items: [] };
      return r.json();
    },
    enabled: open && !!d.clientId,
  });
  const saleOrders = saleOrdersData?.items ?? [];

  const { data: saleQuotesData } = useQuery({
    queryKey: ["sale-quotes", "picker", d.clientId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (d.clientId) p.set("clientId", d.clientId);
      const r = await fetch(`/api/sale-quotes?${p.toString()}`);
      if (!r.ok) return { items: [] };
      return r.json();
    },
    enabled: open && !!d.clientId,
  });
  const saleQuotes = saleQuotesData?.items ?? [];

  const onClientSelect = (c: any) => {
    setSelectedClient(c);
    set("clientId", c.id);
    // Autofill address from client (always overwrite so it reflects the picked client)
    const addr = fullAddress(c);
    if (addr && addr !== "—") set("address", addr);
    setClientOpen(false);
    // reset dependent links
    set("installationId", null);
    set("saleOrderId", null);
    set("saleQuoteId", null);
  };

  const submit = () => {
    const startIso = fromLocalDateTimeInput(d.startAt);
    if (!startIso) {
      toast({ title: "Indica fecha y hora", variant: "destructive" });
      return;
    }
    const payload: any = {
      type: d.type,
      startAt: startIso,
      durationMin: Number(d.durationMin) || 60,
      clientId: d.clientId || null,
      installationId: d.installationId || null,
      saleOrderId: d.saleOrderId || null,
      saleQuoteId: d.saleQuoteId || null,
      assignedToId: d.assignedToId || undefined,
      address: d.address || null,
      notes: d.notes || null,
      status: d.status,
    };
    if (initial?.id) payload.id = initial.id;
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar cita" : "Nueva cita"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status banner if editing */}
          {initial && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">Estado actual:</span>
              <StatusBadge kind="appointment" value={initial.status} />
              {onStatusChange && initial.status === "PENDING" && (
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-700 dark:text-green-400"
                    onClick={() => onStatusChange("DONE")}
                    disabled={loading}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" /> Realizada
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onStatusChange("CANCELLED")}
                    disabled={loading}
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Type */}
          <div>
            <Label>Tipo de cita *</Label>
            <Select
              value={d.type}
              onValueChange={(v) => set("type", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* StartAt + duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>Fecha y hora *</Label>
              <Input
                type="datetime-local"
                value={d.startAt ?? ""}
                onChange={(e) => set("startAt", e.target.value)}
              />
            </div>
            <div>
              <Label>Duración (min)</Label>
              <Select
                value={String(d.durationMin)}
                onValueChange={(v) => set("durationMin", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 60, 90, 120, 180, 240, 480].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n < 60 ? `${n} min` : `${n / 60} h${n % 60 ? ` ${n % 60} min` : ""}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned to */}
          <div>
            <Label>Asignado a</Label>
            <Select
              value={d.assignedToId ?? ""}
              onValueChange={(v) => set("assignedToId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar (por defecto: tú)" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} <span className="text-muted-foreground">· {u.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client (popover + command) */}
          <div>
            <Label>Cliente (opcional)</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedClient ? selectedClient.name : "Buscar cliente..."}
                  <Search className="w-4 h-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 w-[--radix-popover-trigger-width]"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar por nombre, teléfono, NIF..."
                    value={clientQ}
                    onValueChange={setClientQ}
                  />
                  <CommandList>
                    <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c: any) => (
                        <CommandItem
                          key={c.id}
                          onSelect={() => onClientSelect(c)}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[c.phonePrimary, c.city]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedClient && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive mt-1"
                onClick={() => {
                  setSelectedClient(null);
                  set("clientId", null);
                  set("installationId", null);
                  set("saleOrderId", null);
                  set("saleQuoteId", null);
                }}
              >
                Quitar cliente
              </button>
            )}
          </div>

          {/* Installation (filtered by client) */}
          {d.clientId && installations.length > 0 && (
            <div>
              <Label>Instalación (opcional)</Label>
              <Select
                value={d.installationId ?? ""}
                onValueChange={(v) => set("installationId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin vincular" />
                </SelectTrigger>
                <SelectContent>
                  {installations.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {[i.brand, i.model].filter(Boolean).join(" ") || i.equipmentType}
                      {i.serialNumber ? ` (S/N ${i.serialNumber})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sale order + quote (optional, filtered by client) */}
          {d.clientId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {saleOrders.length > 0 && (
                <div>
                  <Label>Pedido de venta (opcional)</Label>
                  <Select
                    value={d.saleOrderId ?? ""}
                    onValueChange={(v) => set("saleOrderId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin vincular" />
                    </SelectTrigger>
                    <SelectContent>
                      {saleOrders.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {saleQuotes.length > 0 && (
                <div>
                  <Label>Presupuesto (opcional)</Label>
                  <Select
                    value={d.saleQuoteId ?? ""}
                    onValueChange={(v) => set("saleQuoteId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin vincular" />
                    </SelectTrigger>
                    <SelectContent>
                      {saleQuotes.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Address (auto-filled from client, editable) */}
          <div>
            <Label>Dirección</Label>
            <Input
              value={d.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Calle, número, ciudad..."
            />
            {d.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <MapPin className="w-3 h-3" /> Abrir en Google Maps
              </a>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>Notas</Label>
            <Textarea
              rows={3}
              value={d.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Detalles de la cita, instrucciones para el técnico..."
            />
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2">
          {onDelete && (
            <Button
              variant="outline"
              className="text-destructive mr-auto"
              onClick={onDelete}
              disabled={deleteLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {initial ? "Guardar cambios" : "Crear cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
