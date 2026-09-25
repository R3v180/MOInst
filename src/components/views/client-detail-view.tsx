"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate, formatDateTime, fullAddress } from "@/lib/format";
import {
  Phone, Mail, MapPin, Wrench, FileText, ClipboardList, Siren, CalendarDays, Plus, Save, Loader2, Pencil, Users, Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export function ClientDetailView() {
  const { params, setView } = useAppStore();
  const id = params.id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => fetch(`/api/clients/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Error al guardar");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Cliente actualizado" });
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["client", id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al eliminar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Cliente eliminado" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setView("clients");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !client) {
    return <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-64" /></div>;
  }

  const openEdit = () => {
    setDraft({
      name: client.name ?? "",
      nif: client.nif ?? "",
      phonePrimary: client.phonePrimary ?? "",
      phoneSecondary: client.phoneSecondary ?? "",
      email: client.email ?? "",
      addressStreet: client.addressStreet ?? "",
      addressNumber: client.addressNumber ?? "",
      addressFloor: client.addressFloor ?? "",
      city: client.city ?? "",
      province: client.province ?? "",
      postalCode: client.postalCode ?? "",
      notes: client.notes ?? "",
    });
    setEditing(true);
  };

  return (
    <div>
      <PageHeader
        title={client.name}
        description={`Cliente desde ${formatDate(client.createdAt)} · ${client.createdBy?.name ?? ""}`}
        backTo="clients"
        actions={
          <>
            <Button variant="outline" onClick={openEdit}>
              <Pencil className="w-4 h-4 mr-2" /> Editar
            </Button>
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Seguro que quieres eliminar a <strong>{client.name}</strong>? Esta acción no se puede deshacer. Se eliminarán también sus instalaciones, presupuestos, pedidos e incidencias asociadas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMut.mutate()}
                    disabled={deleteMut.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => setView("installations")}>
              <Plus className="w-4 h-4 mr-2" /> Instalación
            </Button>
          </>
        }
      />

      <Tabs defaultValue="data" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="data">Datos</TabsTrigger>
          <TabsTrigger value="installations">Instalaciones ({client.installations.length})</TabsTrigger>
          <TabsTrigger value="quotes">Presupuestos ({client.saleQuotes.length})</TabsTrigger>
          <TabsTrigger value="orders">Pedidos ({client.saleOrders.length})</TabsTrigger>
          <TabsTrigger value="incidents">Incidencias ({client.incidents.length})</TabsTrigger>
          <TabsTrigger value="agenda">Agenda ({client.appointments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="data">
          <Card>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:grid-cols-2">
              <Info label="NIF/DNI" value={client.nif} />
              <Info label="Teléfono principal" value={client.phonePrimary} icon={<Phone className="w-4 h-4" />} />
              <Info label="Teléfono secundario" value={client.phoneSecondary} icon={<Phone className="w-4 h-4" />} />
              <Info label="Email" value={client.email} icon={<Mail className="w-4 h-4" />} />
              <Info label="Dirección" value={fullAddress(client)} icon={<MapPin className="w-4 h-4" />} className="sm:col-span-2" />
              <Info label="Notas internas" value={client.notes} className="sm:col-span-2" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="installations">
          <Card>
            <CardContent className="p-4">
              {client.installations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sin instalaciones</p>
              ) : (
                <ul className="divide-y divide-border">
                  {client.installations.map((i: any) => (
                    <li key={i.id}>
                      <button onClick={() => setView("installation-detail", { id: i.id }, [i.brand, i.model].filter(Boolean).join(" ") || i.equipmentType)} className="w-full text-left py-3 hover:bg-accent px-2 -mx-2 rounded flex items-center gap-3">
                        <Wrench className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{[i.brand, i.model].filter(Boolean).join(" ") || i.equipmentType}</div>
                          <div className="text-xs text-muted-foreground">{i.serialNumber ? `S/N ${i.serialNumber}` : i.location ?? "Sin ubicación"} · {formatDate(i.installDate)}</div>
                        </div>
                        <StatusBadge kind="installation" value={i.status} />
                        {i._count.incidents > 0 && <span className="text-xs text-destructive">{i._count.incidents} inc.</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes">
          <Card>
            <CardContent className="p-4">
              {client.saleQuotes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sin presupuestos</p>
              ) : (
                <ul className="divide-y divide-border">
                  {client.saleQuotes.map((q: any) => (
                    <li key={q.id}>
                      <button onClick={() => setView("sale-quote-detail", { id: q.id }, q.number)} className="w-full text-left py-3 hover:bg-accent px-2 -mx-2 rounded flex items-center gap-3">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{q.number}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(q.issueDate)}</div>
                        </div>
                        <span className="text-sm font-semibold">{formatCurrency(q.total)}</span>
                        <StatusBadge kind="saleQuote" value={q.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-4">
              {client.saleOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sin pedidos</p>
              ) : (
                <ul className="divide-y divide-border">
                  {client.saleOrders.map((o: any) => (
                    <li key={o.id}>
                      <button onClick={() => setView("sale-order-detail", { id: o.id }, o.number)} className="w-full text-left py-3 hover:bg-accent px-2 -mx-2 rounded flex items-center gap-3">
                        <ClipboardList className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{o.number}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(o.issueDate)}</div>
                        </div>
                        <StatusBadge kind="payment" value={o.paymentStatus} />
                        <StatusBadge kind="saleOrder" value={o.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <Card>
            <CardContent className="p-4">
              {client.incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sin incidencias</p>
              ) : (
                <ul className="divide-y divide-border">
                  {client.incidents.map((i: any) => (
                    <li key={i.id}>
                      <button onClick={() => setView("incident-detail", { id: i.id }, i.number)} className="w-full text-left py-3 hover:bg-accent px-2 -mx-2 rounded flex items-center gap-3">
                        <Siren className="w-4 h-4 text-destructive shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{i.number}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {[i.installation?.brand, i.installation?.model].filter(Boolean).join(" ")} · {formatDate(i.openedAt)}
                          </div>
                        </div>
                        <StatusBadge kind="incident" value={i.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agenda">
          <Card>
            <CardContent className="p-4">
              {client.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sin citas próximas</p>
              ) : (
                <ul className="divide-y divide-border">
                  {client.appointments.map((a: any) => (
                    <li key={a.id} className="py-3 flex items-center gap-3">
                      <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{formatDateTime(a.startAt)}</div>
                        <div className="text-xs text-muted-foreground">{a.address || a.notes || "Sin detalle"}</div>
                      </div>
                      <span className="text-xs text-muted-foreground">{a.assignedTo?.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label>Nombre / Razón social *</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>NIF/DNI</Label><Input value={draft.nif} onChange={(e) => setDraft({ ...draft, nif: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Teléfono principal</Label><Input value={draft.phonePrimary} onChange={(e) => setDraft({ ...draft, phonePrimary: e.target.value })} /></div>
                <div><Label>Teléfono secundario</Label><Input value={draft.phoneSecondary} onChange={(e) => setDraft({ ...draft, phoneSecondary: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label>Calle</Label><Input value={draft.addressStreet} onChange={(e) => setDraft({ ...draft, addressStreet: e.target.value })} /></div>
                <div><Label>Número</Label><Input value={draft.addressNumber} onChange={(e) => setDraft({ ...draft, addressNumber: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Piso</Label><Input value={draft.addressFloor} onChange={(e) => setDraft({ ...draft, addressFloor: e.target.value })} /></div>
                <div><Label>CP</Label><Input value={draft.postalCode} onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })} /></div>
                <div><Label>Ciudad</Label><Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></div>
              </div>
              <div><Label>Provincia</Label><Input value={draft.province} onChange={(e) => setDraft({ ...draft, province: e.target.value })} /></div>
              <div><Label>Notas internas</Label><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button onClick={() => updateMut.mutate(draft)} disabled={updateMut.isPending}>
              {updateMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value, icon, className }: { label: string; value?: string | null; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-sm font-medium mt-0.5">{value || "—"}</div>
    </div>
  );
}
