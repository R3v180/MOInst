"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Plus, Search, Truck, Phone, Mail, MapPin, Loader2, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

export function SuppliersView() {
  const { setView } = useAppStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", q],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      const r = await fetch(`/api/suppliers?${p.toString()}`);
      return r.json();
    },
    placeholderData: (prev: any) => prev,
  });

  const items = data?.items ?? [];

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/suppliers", {
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
    onSuccess: (supplier) => {
      toast({ title: "Proveedor creado" });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setShowNew(false);
      setView("supplier-detail", { id: supplier.id }, supplier.name);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Proveedores"
        description={`${data?.total ?? 0} proveedores`}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo proveedor
          </Button>
        }
      />

      {/* Filtro */}
      <div className="relative flex-1 mb-4 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o contacto..."
          className="pl-9"
        />
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
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Truck className="w-6 h-6" />}
          title="Sin proveedores"
          description="Crea tu primer proveedor para empezar a registrar precios de artículos y pedidos de compra."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nuevo proveedor
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setView("supplier-detail", { id: s.id }, s.name)}
              className="text-left"
            >
              <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{s.name}</div>
                      {s.contactName && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" /> {s.contactName}
                        </div>
                      )}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {s.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" /> {s.phone}
                      </div>
                    )}
                    {s.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </div>
                    )}
                    {s.address && (
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{s.address}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Truck className="w-3.5 h-3.5" /> {s.articlesCount ?? 0} artículos
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Nuevo proveedor */}
      <SupplierForm
        open={showNew}
        onOpenChange={setShowNew}
        onSubmit={(d) => createMut.mutate(d)}
        loading={createMut.isPending}
      />
    </div>
  );
}

function SupplierForm({
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
  const [d, setD] = useState<any>({});
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Nuevo proveedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre / Razón social *</Label>
            <Input
              value={d.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ej. Distribución Climática S.L."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Teléfono</Label>
              <Input
                value={d.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={d.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Dirección</Label>
            <Input
              value={d.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Calle, número, CP, ciudad"
            />
          </div>
          <div>
            <Label>Persona de contacto</Label>
            <Input
              value={d.contactName ?? ""}
              onChange={(e) => set("contactName", e.target.value)}
            />
          </div>
          <div>
            <Label>Notas internas</Label>
            <Textarea
              rows={2}
              value={d.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="ej. descuentos por volumen, agente comercial..."
            />
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
