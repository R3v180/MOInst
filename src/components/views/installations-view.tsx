"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, daysUntil } from "@/lib/format";
import {
  Wrench, Plus, Search, Loader2, MapPin, Calendar, ShieldCheck, Siren, Filter,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activa" },
  { value: "REMOVED", label: "Retirada" },
  { value: "REPLACED", label: "Sustituida" },
];

export function InstallationsView() {
  const { setView } = useAppStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [equipmentType, setEquipmentType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const pageSize = 24;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["installations", q, equipmentType, status, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (equipmentType !== "all") p.set("equipmentType", equipmentType);
      if (status !== "all") p.set("status", status);
      p.set("page", String(page));
      p.set("pageSize", String(pageSize));
      const r = await fetch(`/api/installations?${p.toString()}`);
      if (!r.ok) throw new Error("Error al cargar instalaciones");
      return r.json();
    },
  });

  const meta = data?.meta ?? { installationTypes: [], defaultWarrantyMonths: 24 };
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Cuando cambian los filtros, volvemos a la página 1
  const onFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al crear instalación");
      }
      return r.json();
    },
    onSuccess: (inst) => {
      toast({ title: "Instalación creada", description: `${inst.client?.name ?? ""}` });
      qc.invalidateQueries({ queryKey: ["installations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setShowNew(false);
      setView("installation-detail", { id: inst.id });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Instalaciones"
        description={`${total} ${total === 1 ? "instalación" : "instalaciones"} registradas`}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nueva instalación
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nº serie, marca, modelo o cliente..."
            className="pl-9"
          />
        </div>
        <Select value={equipmentType} onValueChange={onFilterChange(setEquipmentType)}>
          <SelectTrigger className="w-full sm:w-56">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Tipo de equipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {meta.installationTypes.map((t: string) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={onFilterChange(setStatus)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-6 h-6" />}
          title="Sin instalaciones"
          description="Crea tu primera instalación para empezar a registrar equipos, mantenimientos e incidencias."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nueva instalación
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((i: any) => {
              const days = daysUntil(i.warrantyEndDate);
              const expired = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days < 30;
              return (
                <button
                  key={i.id}
                  onClick={() => setView("installation-detail", { id: i.id })}
                  className="text-left"
                >
                  <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full">
                    <CardContent className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {[i.brand, i.model].filter(Boolean).join(" ") || i.equipmentType}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {i.serialNumber ? `S/N ${i.serialNumber}` : "Sin nº serie"}
                          </div>
                        </div>
                        <StatusBadge kind="installation" value={i.status} />
                      </div>

                      <div className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Wrench className="w-3 h-3" /> {i.equipmentType}
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-muted-foreground">Cliente:</span>
                          <span className="font-medium truncate">{i.client?.name ?? "—"}</span>
                        </div>
                        {i.location && (
                          <div className="flex items-center gap-2 truncate text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{i.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          Instalada {formatDate(i.installDate)}
                        </div>
                      </div>

                      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2 text-xs">
                        <div className={
                          expired
                            ? "flex items-center gap-1 text-destructive font-medium"
                            : soon
                              ? "flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"
                              : "flex items-center gap-1 text-muted-foreground"
                        }>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {i.warrantyEndDate ? (
                            <>Garantía: {formatDate(i.warrantyEndDate)}{expired ? " (caducada)" : soon ? ` · ${days}d` : ""}</>
                          ) : (
                            "Sin garantía"
                          )}
                        </div>
                        {i._count?.incidents > 0 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <Siren className="w-3.5 h-3.5" /> {i._count.incidents}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-6">
              <p className="text-xs text-muted-foreground">
                Página {page} de {totalPages} · {total} resultados
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isFetching}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Nueva instalación */}
      <InstallationForm
        open={showNew}
        onOpenChange={setShowNew}
        installationTypes={meta.installationTypes}
        defaultWarrantyMonths={meta.defaultWarrantyMonths}
        onSubmit={(d) => createMut.mutate(d)}
        loading={createMut.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diálogo de creación
// ─────────────────────────────────────────────────────────────────────────────
function InstallationForm({
  open,
  onOpenChange,
  installationTypes,
  defaultWarrantyMonths,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  installationTypes: string[];
  defaultWarrantyMonths: number;
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [d, setD] = useState<any>({});
  const [clientOpen, setClientOpen] = useState(false);
  const [clientQ, setClientQ] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }));

  // Fetch de clientes (solo cuando se abre el diálogo)
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

  // Calcula y sugiere el fin de garantía al cambiar la fecha de instalación
  const setInstallDate = (iso: string) => {
    if (iso && !d.warrantyEndDate && defaultWarrantyMonths) {
      const dt = new Date(iso);
      if (!isNaN(dt.getTime())) {
        dt.setMonth(dt.getMonth() + Number(defaultWarrantyMonths));
        setD((p) => ({ ...p, installDate: iso, warrantyEndDate: dt.toISOString().slice(0, 10) }));
        return;
      }
    }
    set("installDate", iso);
  };

  const submit = () => {
    if (!selectedClient) {
      toast({ title: "Selecciona un cliente", variant: "destructive" });
      return;
    }
    if (!d.equipmentType) {
      toast({ title: "Selecciona el tipo de equipo", variant: "destructive" });
      return;
    }
    if (!d.installDate) {
      toast({ title: "Indica la fecha de instalación", variant: "destructive" });
      return;
    }
    onSubmit({
      clientId: selectedClient.id,
      equipmentType: d.equipmentType,
      brand: d.brand || null,
      model: d.model || null,
      serialNumber: d.serialNumber || null,
      location: d.location || null,
      installDate: d.installDate,
      warrantyEndDate: d.warrantyEndDate || null,
      notes: d.notes || null,
    });
  };

  const close = (v: boolean) => {
    if (!v) {
      setD({});
      setSelectedClient(null);
      setClientQ("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Nueva instalación</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Cliente buscable */}
          <div>
            <Label>Cliente *</Label>
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
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
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
                          onSelect={() => {
                            setSelectedClient(c);
                            setClientOpen(false);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[c.phonePrimary, c.city].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de equipo *</Label>
              <Select
                value={d.equipmentType ?? ""}
                onValueChange={(v) => set("equipmentType", v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                <SelectContent>
                  {installationTypes.map((t: string) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input
                value={d.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
                placeholder="ej. Salón, cocina, azotea..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Marca</Label>
              <Input value={d.brand ?? ""} onChange={(e) => set("brand", e.target.value)} placeholder="ej. Daikin, Bosch" />
            </div>
            <div>
              <Label>Modelo</Label>
              <Input value={d.model ?? ""} onChange={(e) => set("model", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nº de serie</Label>
              <Input value={d.serialNumber ?? ""} onChange={(e) => set("serialNumber", e.target.value)} />
            </div>
            <div>
              <Label>Fecha de instalación *</Label>
              <Input
                type="date"
                value={d.installDate ?? ""}
                onChange={(e) => setInstallDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fin de garantía {defaultWarrantyMonths ? `(sug. +${defaultWarrantyMonths}m)` : ""}</Label>
              <Input
                type="date"
                value={d.warrantyEndDate ?? ""}
                onChange={(e) => set("warrantyEndDate", e.target.value)}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={d.status ?? "ACTIVE"}
                onValueChange={(v) => set("status", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notas internas</Label>
            <Textarea
              rows={3}
              value={d.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="ej. Equipo con bomba de calor, instalación en piso superior..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Crear instalación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
