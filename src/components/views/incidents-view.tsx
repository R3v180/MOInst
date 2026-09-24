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
import { formatDate, formatDateTime } from "@/lib/format";
import {
  Siren, Plus, Search, Loader2, Wrench, Filter, AlertCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Abierta" },
  { value: "IN_RESOLUTION", label: "En resolución" },
  { value: "CLOSED", label: "Cerrada" },
];

export function IncidentsView() {
  const { setView } = useAppStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [clientId, setClientId] = useState("all");
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const pageSize = 25;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["incidents", q, status, clientId, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (status !== "all") p.set("status", status);
      if (clientId !== "all") p.set("clientId", clientId);
      p.set("page", String(page));
      p.set("pageSize", String(pageSize));
      const r = await fetch(`/api/incidents?${p.toString()}`);
      if (!r.ok) throw new Error("Error al cargar incidencias");
      return r.json();
    },
  });

  // Lista de clientes para el filtro
  const { data: clientsData } = useQuery({
    queryKey: ["clients", "", "", false],
    queryFn: () => fetch(`/api/clients?pageSize=200`).then((r) => r.json()),
  });
  const clients = clientsData?.items ?? [];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const onFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al crear incidencia");
      }
      return r.json();
    },
    onSuccess: (inc) => {
      toast({
        title: "Incidencia abierta",
        description: `${inc.number} · ${inc.client?.name ?? ""}`,
      });
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setShowNew(false);
      setView("incident-detail", { id: inc.id });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Incidencias / Garantías"
        description={`${total} ${total === 1 ? "incidencia" : "incidencias"} registradas`}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nueva incidencia
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número (INC-...), descripción o cliente..."
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={onFilterChange(setStatus)}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clientId} onValueChange={onFilterChange(setClientId)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
          icon={<Siren className="w-6 h-6" />}
          title="Sin incidencias"
          description="Registra avisos de clientes, reparaciones en garantía o problemas con instalaciones para tener la trazabilidad completa."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nueva incidencia
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((i: any) => {
              const instLabel = i.installation
                ? [i.installation.brand, i.installation.model].filter(Boolean).join(" ") || i.installation.equipmentType
                : null;
              return (
                <button
                  key={i.id}
                  onClick={() => setView("incident-detail", { id: i.id })}
                  className="text-left"
                >
                  <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full">
                    <CardContent className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-semibold text-primary truncate">
                            {i.number}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {i.client?.name ?? "—"}
                          </div>
                        </div>
                        <StatusBadge kind="incident" value={i.status} />
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {i.description}
                      </p>

                      {instLabel && (
                        <div className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <Wrench className="w-3 h-3" /> {instLabel}
                          {i.installation?.serialNumber && (
                            <span className="opacity-70">· S/N {i.installation.serialNumber}</span>
                          )}
                        </div>
                      )}

                      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          Abierta {formatDateTime(i.openedAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          {(i._count?.attachments ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> {i._count.attachments}
                            </span>
                          )}
                          {i.closedAt && (
                            <span>Cerrada {formatDate(i.closedAt)}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

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

      <IncidentForm
        open={showNew}
        onOpenChange={setShowNew}
        onSubmit={(d) => createMut.mutate(d)}
        loading={createMut.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diálogo "Nueva incidencia"
//   - Cliente buscable (Popover + Command)
//   - Instalación filtrada por cliente (GET /api/installations?clientId=X)
//   - Descripción textarea
// ─────────────────────────────────────────────────────────────────────────────
function IncidentForm({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [description, setDescription] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [clientQ, setClientQ] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [installationId, setInstallationId] = useState<string>("");

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

  // Instalaciones del cliente seleccionado
  const { data: installationsData, isLoading: loadingInsts } = useQuery({
    queryKey: ["installations", "by-client", selectedClient?.id],
    queryFn: async () => {
      const r = await fetch(
        `/api/installations?clientId=${selectedClient.id}&pageSize=100`
      );
      if (!r.ok) return { items: [] };
      return r.json();
    },
    enabled: !!selectedClient,
  });
  const installations = installationsData?.items ?? [];

  // Al cambiar el cliente, resetea la instalación elegida
  const pickClient = (c: any) => {
    setSelectedClient(c);
    setInstallationId("");
    setClientOpen(false);
  };

  const submit = () => {
    if (!selectedClient) {
      toast({ title: "Selecciona un cliente", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "La descripción es obligatoria", variant: "destructive" });
      return;
    }
    onSubmit({
      clientId: selectedClient.id,
      installationId: installationId || null,
      saleOrderId: null,
      description: description.trim(),
    });
  };

  const close = (v: boolean) => {
    if (!v) {
      setDescription("");
      setSelectedClient(null);
      setInstallationId("");
      setClientQ("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Nueva incidencia</DialogTitle>
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
                          onSelect={() => pickClient(c)}
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

          {/* Instalación filtrada por cliente */}
          <div>
            <Label>
              Instalación {selectedClient ? "(opcional)" : "(selecciona un cliente primero)"}
            </Label>
            {selectedClient ? (
              installations.length === 0 && !loadingInsts ? (
                <div className="text-sm text-muted-foreground italic px-3 py-2 border border-dashed rounded-md">
                  El cliente no tiene instalaciones registradas. Puedes abrir la incidencia sin vincular.
                </div>
              ) : (
                <Select value={installationId} onValueChange={setInstallationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin vincular instalación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin vincular</SelectItem>
                    {installations.map((i: any) => {
                      const label = [i.brand, i.model].filter(Boolean).join(" ") || i.equipmentType;
                      return (
                        <SelectItem key={i.id} value={i.id}>
                          {label}
                          {i.serialNumber ? ` · S/N ${i.serialNumber}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )
            ) : (
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente primero" />
                </SelectTrigger>
              </Select>
            )}
          </div>

          {/* Descripción */}
          <div>
            <Label>Descripción *</Label>
            <Textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ej. El split no enfría. Cliente dice que hace ruido raro desde hace 2 días..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Siren className="w-4 h-4 mr-2" />}
            Abrir incidencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
