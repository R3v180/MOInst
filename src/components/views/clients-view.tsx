"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { fullAddress, formatDate } from "@/lib/format";
import { Users, Plus, Search, Phone, Mail, MapPin, Siren, Wrench, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

export function ClientsView() {
  const { setView } = useAppStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const [onlyIncidents, setOnlyIncidents] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [debounce, setDebounce] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", q, city, onlyIncidents],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (city !== "all") p.set("city", city);
      if (onlyIncidents) p.set("incidents", "1");
      const r = await fetch(`/api/clients?${p.toString()}`);
      return r.json();
    },
  });

  const cities = data?.cities ?? [];
  const items = data?.items ?? [];

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Error");
      }
      return r.json();
    },
    onSuccess: (client) => {
      toast({ title: "Cliente creado" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setShowNew(false);
      setView("client-detail", { id: client.id }, client.name);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // debounce búsqueda
  const onSearch = (v: string) => {
    setDebounce((n) => n + 1);
    setQ(v);
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description={`${data?.total ?? 0} clientes`}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo cliente
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, email, NIF..."
            className="pl-9"
          />
        </div>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Todas las ciudades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ciudades</SelectItem>
            {cities.map((c: string) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-background">
          <Switch id="incidents" checked={onlyIncidents} onCheckedChange={setOnlyIncidents} />
          <Label htmlFor="incidents" className="text-sm cursor-pointer">Con incidencias</Label>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="Sin clientes"
          description="Crea tu primer cliente para empezar a registrar instalaciones y presupuestos."
          action={<Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-2" /> Nuevo cliente</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setView("client-detail", { id: c.id }, c.name)}
              className="text-left"
            >
              <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      {c.nif && <div className="text-xs text-muted-foreground">NIF: {c.nif}</div>}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {c.phonePrimary && (
                      <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {c.phonePrimary}</div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{c.email}</span></div>
                    )}
                    {c.city && (
                      <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {fullAddress(c) || c.city}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Wrench className="w-3.5 h-3.5" /> {c._count.installations} inst.
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" /> {c._count.saleOrders} pedidos
                    </span>
                    {c._count.incidents > 0 && (
                      <span className="flex items-center gap-1 text-destructive ml-auto">
                        <Siren className="w-3.5 h-3.5" /> {c._count.incidents}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Nuevo cliente */}
      <ClientForm
        open={showNew}
        onOpenChange={setShowNew}
        onSubmit={(d) => createMut.mutate(d)}
        loading={createMut.isPending}
      />
    </div>
  );
}

function ClientForm({
  open, onOpenChange, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [d, setD] = useState<any>({});
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nombre / Razón social *</Label>
            <Input value={d.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>NIF/DNI</Label>
              <Input value={d.nif ?? ""} onChange={(e) => set("nif", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={d.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Teléfono principal</Label>
              <Input value={d.phonePrimary ?? ""} onChange={(e) => set("phonePrimary", e.target.value)} />
            </div>
            <div>
              <Label>Teléfono secundario</Label>
              <Input value={d.phoneSecondary ?? ""} onChange={(e) => set("phoneSecondary", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Calle</Label>
              <Input value={d.addressStreet ?? ""} onChange={(e) => set("addressStreet", e.target.value)} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={d.addressNumber ?? ""} onChange={(e) => set("addressNumber", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Piso / Puerta</Label>
              <Input value={d.addressFloor ?? ""} onChange={(e) => set("addressFloor", e.target.value)} />
            </div>
            <div>
              <Label>Código postal</Label>
              <Input value={d.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input value={d.city ?? ""} onChange={(e) => set("city", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Provincia</Label>
            <Input value={d.province ?? ""} onChange={(e) => set("province", e.target.value)} />
          </div>
          <div>
            <Label>Notas internas</Label>
            <Input value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="ej. prefiere visitas por la tarde" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSubmit(d)} disabled={loading || !d.name}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
