"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AttachmentUploader, AttachmentThumb } from "@/components/shared/attachment-uploader";
import { formatCurrency, formatDate, fullAddress } from "@/lib/format";
import {
  ClipboardList, Loader2, ChevronDown, Wrench, FileText, FileInput,
  Siren, Truck, Plus, Save, Package, Check,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type InstallItem =
  | { mode: "new"; clientId: string; equipmentType: string; brand?: string | null; model?: string | null; serialNumber?: string | null; location?: string | null; warrantyEndDate?: string | null; notes?: string | null }
  | { mode: "link"; installationId: string };

export function SaleOrderDetailView() {
  const { params, setView } = useAppStore();
  const id = params.id;
  const qc = useQueryClient();

  const [showInstall, setShowInstall] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["sale-order", id],
    queryFn: () => fetch(`/api/sale-orders/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  // Lista de instalaciones del cliente (para vínculo)
  const { data: clientInstallations } = useQuery({
    queryKey: ["client-installations-for-order", order?.clientId],
    queryFn: async () => {
      // No existe /api/installations, pero podemos obtenerlas vía /api/clients/[id]
      const r = await fetch(`/api/clients/${order.clientId}`);
      if (!r.ok) return [];
      const data = await r.json();
      return (data.installations ?? []) as any[];
    },
    enabled: !!order?.clientId,
  });

  useEffect(() => {
    if (order && notesDraft === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotesDraft(order.notes ?? "");
    }
  }, [order, notesDraft]);

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/sale-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al actualizar");
      }
      return r.json();
    },
    onSuccess: (_d, vars) => {
      toast({
        title:
          vars.status !== undefined ? "Estado actualizado"
          : vars.paymentStatus !== undefined ? "Estado de pago actualizado"
          : "Pedido actualizado",
      });
      qc.invalidateQueries({ queryKey: ["sale-order", id] });
      qc.invalidateQueries({ queryKey: ["sale-orders"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const installMut = useMutation({
    mutationFn: async (items: InstallItem[]) => {
      const r = await fetch(`/api/sale-orders/${id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al registrar instalación");
      }
      return r.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pedido instalado",
        description: `${data.installations.length} instalación(es) registradas`,
      });
      setShowInstall(false);
      qc.invalidateQueries({ queryKey: ["sale-order", id] });
      qc.invalidateQueries({ queryKey: ["sale-orders"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !order) {
    return <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-96" /></div>;
  }

  const client = order.client;
  const status = order.status;
  const payment = order.paymentStatus;

  const saveNotes = () => {
    if (notesDraft !== null && notesDraft !== (order.notes ?? "")) {
      updateMut.mutate({ notes: notesDraft || null });
    }
  };

  return (
    <div>
      <PageHeader
        title={order.number}
        description={`Cliente: ${client?.name ?? "—"} · Emitido ${formatDate(order.issueDate)}`}
        backTo="sale-orders"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={updateMut.isPending}>
                  {updateMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                  Cambiar estado
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Estado del pedido</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {["PENDING", "IN_PROGRESS", "INSTALLED", "CLOSED"].map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => updateMut.mutate({ status: s })}
                    disabled={status === s}
                    className="flex items-center justify-between"
                  >
                    <StatusBadge kind="saleOrder" value={s} />
                    {status === s && <Check className="w-3.5 h-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {status !== "INSTALLED" && status !== "CLOSED" && (
              <Button onClick={() => setShowInstall(true)}>
                <Wrench className="w-4 h-4 mr-2" /> Marcar instalado
              </Button>
            )}

            <Button
              variant={payment === "PAID" ? "default" : "outline"}
              onClick={() => updateMut.mutate({ paymentStatus: payment === "PAID" ? "PENDING" : "PAID" })}
              disabled={updateMut.isPending}
            >
              {payment === "PAID" ? (
                <><Check className="w-4 h-4 mr-2" /> Cobrado</>
              ) : (
                <><Package className="w-4 h-4 mr-2" /> Marcar cobrado</>
              )}
            </Button>

            <Button variant="outline" onClick={() => setView("incidents", { saleOrderId: id, clientId: order.clientId })}>
              <Siren className="w-4 h-4 mr-2" /> Nueva incidencia
            </Button>

            <AttachmentUploader entityType="SALE_ORDER" entityId={id} label="Adjuntar albarán" onUploaded={() => qc.invalidateQueries({ queryKey: ["sale-order", id] })} />
          </>
        }
      />

      {/* Header card */}
      <Card className="mb-4">
        <CardContent className="p-4 sm:p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Cliente</div>
            <button
              className="text-sm font-medium text-primary hover:underline truncate text-left"
              onClick={() => setView("client-detail", { id: order.clientId })}
            >
              {client?.name ?? "—"}
            </button>
            <div className="text-xs text-muted-foreground mt-0.5">{fullAddress(client)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Presupuesto de origen</div>
            {order.sourceSaleQuote ? (
              <button
                className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                onClick={() => setView("sale-quote-detail", { id: order.sourceSaleQuote.id })}
              >
                <FileText className="w-3.5 h-3.5" />
                {order.sourceSaleQuote.number}
              </button>
            ) : (
              <span className="text-sm text-muted-foreground">— Pedido directo —</span>
            )}
            {order.sourceSaleQuote && (
              <div className="text-xs text-muted-foreground">Total presupuesto: {formatCurrency(order.sourceSaleQuote.total)}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Emisión</div>
            <div className="text-sm font-medium">{formatDate(order.issueDate)}</div>
            {order.createdBy?.name && (
              <div className="text-xs text-muted-foreground">Creado por {order.createdBy.name}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Estado / Pago</div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge kind="saleOrder" value={status} />
              <StatusBadge kind="payment" value={payment} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Líneas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" /> Líneas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(!order.lines || order.lines.length === 0) ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Sin líneas.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="w-20">Cant.</TableHead>
                        <TableHead className="w-28">P. unit.</TableHead>
                        <TableHead className="w-20">Desc.</TableHead>
                        <TableHead className="w-32 text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.lines.map((l: any) => (
                        <TableRow key={l.id} className={l.isLabor ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}>
                          <TableCell>
                            <div className="text-sm font-medium">{l.description}</div>
                            {l.isLabor && <Badge variant="outline" className="mt-0.5 text-amber-700 border-amber-300">Mano de obra</Badge>}
                            {l.article && (
                              <div className="text-xs text-muted-foreground">{l.article.internalCode}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{l.quantity}</TableCell>
                          <TableCell className="text-sm">{formatCurrency(l.unitPrice)}</TableCell>
                          <TableCell className="text-sm">{l.discount}%</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(l.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {order.lines && order.lines.length > 0 && (
                <div className="flex justify-end p-4 border-t border-border">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total pedido</div>
                    <div className="text-lg font-bold">
                      {formatCurrency(order.lines.reduce((s: number, l: any) => s + l.subtotal, 0))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instalaciones generadas */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" /> Instalaciones generadas
              </CardTitle>
              {status !== "INSTALLED" && status !== "CLOSED" && (
                <Button size="sm" variant="outline" onClick={() => setShowInstall(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Vincular / crear
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {order.installations.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No hay instalaciones vinculadas. Marca el pedido como instalado para crearlas.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {order.installations.map((i: any) => (
                    <li key={i.id}>
                      <button
                        onClick={() => setView("installation-detail", { id: i.id })}
                        className="w-full text-left py-3 px-4 hover:bg-accent flex items-center gap-3"
                      >
                        <Wrench className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {[i.brand, i.model].filter(Boolean).join(" ") || i.equipmentType}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {i.serialNumber ? `S/N ${i.serialNumber}` : ""} · {i.location ?? ""}
                          </div>
                        </div>
                        <StatusBadge kind="installation" value={i.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Albaranes de entrega */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" /> Albaranes de entrega
              </CardTitle>
              <AttachmentUploader entityType="SALE_ORDER" entityId={id} variant="compact" onUploaded={() => qc.invalidateQueries({ queryKey: ["sale-order", id] })} />
            </CardHeader>
            <CardContent>
              {order.deliveryAlbaranes && order.deliveryAlbaranes.length > 0 ? (
                <div className="space-y-3">
                  {order.deliveryAlbaranes.map((a: any) => (
                    <div key={a.id} className="border border-border rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-sm font-medium">Albarán · {formatDate(a.date)}</div>
                          <div className="text-xs text-muted-foreground">Subido por {a.uploadedBy?.name ?? "—"}</div>
                        </div>
                        <Badge variant="outline">{a.notes ?? "CLIENT_DELIVERY"}</Badge>
                      </div>
                      {a.attachments && a.attachments.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {a.attachments.map((f: any) => (
                            <AttachmentThumb key={f.id} file={f} onDelete={async () => {
                              await fetch(`/api/attachments/${f.id}`, { method: "DELETE" });
                              qc.invalidateQueries({ queryKey: ["sale-order", id] });
                            }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : order.attachments && order.attachments.length > 0 ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Adjuntos del pedido (no vinculados a albarán)</div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {order.attachments.map((f: any) => (
                      <AttachmentThumb key={f.id} file={f} onDelete={async () => {
                        await fetch(`/api/attachments/${f.id}`, { method: "DELETE" });
                        qc.invalidateQueries({ queryKey: ["sale-order", id] });
                      }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Sin albaranes de entrega. Adjunta fotos o PDF del parte de entrega.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna lateral */}
        <div className="space-y-4">
          {/* Compras vinculadas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileInput className="w-4 h-4 text-primary" /> Compras vinculadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Presupuestos de compra</div>
                {order.purchaseQuotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin presupuestos de compra.</p>
                ) : (
                  <ul className="divide-y divide-border border border-border rounded-md">
                    {order.purchaseQuotes.map((q: any) => (
                      <li key={q.id}>
                        <button
                          onClick={() => setView("purchase-quote-detail", { id: q.id })}
                          className="w-full text-left py-2 px-3 hover:bg-accent flex items-center gap-2"
                        >
                          <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{q.supplier?.name}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(q.issueDate)}</div>
                          </div>
                          <StatusBadge kind="purchaseQuote" value={q.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Pedidos de compra</div>
                {order.purchaseOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin pedidos de compra.</p>
                ) : (
                  <ul className="divide-y divide-border border border-border rounded-md">
                    {order.purchaseOrders.map((p: any) => (
                      <li key={p.id}>
                        <button
                          onClick={() => setView("purchase-order-detail", { id: p.id })}
                          className="w-full text-left py-2 px-3 hover:bg-accent flex items-center gap-2"
                        >
                          <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{p.number}</div>
                            <div className="text-xs text-muted-foreground">{p.supplier?.name}</div>
                          </div>
                          <StatusBadge kind="purchaseOrder" value={p.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Incidencias */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Siren className="w-4 h-4 text-destructive" /> Incidencias
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setView("incidents", { saleOrderId: id, clientId: order.clientId })}>
                <Plus className="w-4 h-4 mr-1" /> Nueva
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {order.incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin incidencias.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {order.incidents.map((i: any) => (
                    <li key={i.id}>
                      <button
                        onClick={() => setView("incident-detail", { id: i.id })}
                        className="w-full text-left py-2 px-4 hover:bg-accent flex items-center gap-2"
                      >
                        <Siren className="w-3.5 h-3.5 text-destructive shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{i.number}</div>
                          <div className="text-xs text-muted-foreground truncate">{i.description}</div>
                        </div>
                        <StatusBadge kind="incident" value={i.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Notas */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">Notas</CardTitle>
              <Button size="sm" variant="ghost" onClick={saveNotes} disabled={updateMut.isPending}>
                {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notesDraft ?? ""}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={saveNotes}
                rows={4}
                placeholder="Notas internas del pedido..."
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Diálogo: marcar instalado */}
      <InstallDialog
        open={showInstall}
        onOpenChange={setShowInstall}
        loading={installMut.isPending}
        clientId={order.clientId}
        clientName={client?.name ?? ""}
        availableInstallations={clientInstallations ?? []}
        onSubmit={(items) => installMut.mutate(items)}
      />
    </div>
  );
}

function InstallDialog({
  open,
  onOpenChange,
  loading,
  clientId,
  clientName,
  availableInstallations,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  clientId: string;
  clientName: string;
  availableInstallations: any[];
  onSubmit: (items: InstallItem[]) => void;
}) {
  const [items, setItems] = useState<InstallItem[]>([
    { mode: "new", clientId, equipmentType: "aire acondicionado", brand: "", model: "", serialNumber: "", location: "", warrantyEndDate: "", notes: "" },
  ]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([
        { mode: "new", clientId, equipmentType: "aire acondicionado", brand: "", model: "", serialNumber: "", location: "", warrantyEndDate: "", notes: "" },
      ]);
    }
  }, [open, clientId]);

  const addNew = () => {
    setItems((prev) => [
      ...prev,
      { mode: "new", clientId, equipmentType: "aire acondicionado", brand: "", model: "", serialNumber: "", location: "", warrantyEndDate: "", notes: "" },
    ]);
  };
  const addLink = () => {
    setItems((prev) => [...prev, { mode: "link", installationId: availableInstallations[0]?.id ?? "" }]);
  };
  const update = (idx: number, patch: any) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } as InstallItem : it)));
  };
  const remove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = () => {
    // Validar
    for (const it of items) {
      if (it.mode === "new") {
        if (!it.equipmentType || !it.clientId) {
          toast({ title: "Faltan datos en una instalación nueva", variant: "destructive" });
          return;
        }
      } else if (!it.installationId) {
        toast({ title: "Selecciona una instalación a vincular", variant: "destructive" });
        return;
      }
    }
    onSubmit(items);
  };

  // Filtrar instalaciones ya vinculadas a este pedido
  const available = availableInstallations.filter(
    (i) => !items.some((it) => it.mode === "link" && it.installationId === i.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Marcar pedido como instalado</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cliente: <span className="font-medium text-foreground">{clientName}</span>. Registra los equipos instalados o vincula instalaciones ya existentes.
        </p>

        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="border border-border rounded-md p-3 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase text-muted-foreground font-semibold">
                  {it.mode === "new" ? "Nueva instalación" : "Vincular existente"}
                </div>
                {items.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => remove(idx)}>
                    Quitar
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Label className="text-xs w-20">Modo</Label>
                <Select
                  value={it.mode}
                  onValueChange={(v) => update(idx, v === "link" ? { mode: "link", installationId: available[0]?.id ?? "" } : { mode: "new", clientId, equipmentType: "aire acondicionado", brand: "", model: "", serialNumber: "", location: "", warrantyEndDate: "", notes: "" })}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Crear nueva</SelectItem>
                    <SelectItem value="link">Vincular existente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {it.mode === "new" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Tipo de equipo *</Label>
                    <Select
                      value={(it as any).equipmentType}
                      onValueChange={(v) => update(idx, { equipmentType: v })}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aire acondicionado">Aire acondicionado</SelectItem>
                        <SelectItem value="caldera">Caldera</SelectItem>
                        <SelectItem value="termo">Termo</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Marca</Label>
                    <Input value={(it as any).brand ?? ""} onChange={(e) => update(idx, { brand: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Modelo</Label>
                    <Input value={(it as any).model ?? ""} onChange={(e) => update(idx, { model: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Nº de serie</Label>
                    <Input value={(it as any).serialNumber ?? ""} onChange={(e) => update(idx, { serialNumber: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Ubicación</Label>
                    <Input value={(it as any).location ?? ""} onChange={(e) => update(idx, { location: e.target.value })} className="h-8" placeholder="Salón, cocina..." />
                  </div>
                  <div>
                    <Label className="text-xs">Fin de garantía</Label>
                    <Input type="date" value={(it as any).warrantyEndDate ?? ""} onChange={(e) => update(idx, { warrantyEndDate: e.target.value || null })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Notas</Label>
                    <Input value={(it as any).notes ?? ""} onChange={(e) => update(idx, { notes: e.target.value })} className="h-8" />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Instalación a vincular *</Label>
                  {available.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">No hay instalaciones disponibles para vincular.</p>
                  ) : (
                    <Select
                      value={(it as any).installationId}
                      onValueChange={(v) => update(idx, { installationId: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecciona instalación" /></SelectTrigger>
                      <SelectContent>
                        {available.map((i: any) => (
                          <SelectItem key={i.id} value={i.id}>
                            {[i.brand, i.model, i.serialNumber].filter(Boolean).join(" ") || i.equipmentType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addNew}><Plus className="w-4 h-4 mr-1" /> Otra nueva</Button>
          <Button variant="outline" size="sm" onClick={addLink} disabled={available.length === 0}><Plus className="w-4 h-4 mr-1" /> Vincular existente</Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || items.length === 0}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Marcar instalado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
