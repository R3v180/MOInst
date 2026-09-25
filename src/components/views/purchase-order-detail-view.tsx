"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AttachmentUploader,
  AttachmentThumb,
} from "@/components/shared/attachment-uploader";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/format";
import {
  Truck,
  ShoppingCart,
  FileText,
  ChevronDown,
  Camera,
  Package,
  Loader2,
  Pencil,
  Save,
  X,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

export function PurchaseOrderDetailView() {
  const { params, setView } = useAppStore();
  const id = params.id;
  const qc = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [showAlbaranDialog, setShowAlbaranDialog] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: async () => {
      const r = await fetch(`/api/purchase-orders/${id}`);
      if (!r.ok) throw new Error("Error al cargar");
      return r.json();
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (order) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes(order.notes ?? "");
    }
  }, [order]);

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Error");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Pedido actualizado" });
      setEditingNotes(false);
      qc.invalidateQueries({ queryKey: ["purchase-order", id] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAlbaranMut = useMutation({
    mutationFn: async (albId: string) => {
      const r = await fetch(`/api/albaranes/${albId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Error al borrar albarán");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Albarán eliminado" });
      qc.invalidateQueries({ queryKey: ["purchase-order", id] });
      qc.invalidateQueries({ queryKey: ["albaranes"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={order.number}
        description={`Emitido ${formatDateTime(order.issueDate)} · ${order.createdBy?.name ?? ""}`}
        backTo="purchase-orders"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Estado: <StatusBadge kind="purchaseOrder" value={order.status} />
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => updateMut.mutate({ status: "PENDING" })}>
                  Pendiente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateMut.mutate({ status: "PARTIAL_RECEIVED" })}>
                  Parcial
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateMut.mutate({ status: "RECEIVED" })}>
                  Recibido
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setShowAlbaranDialog(true)} className="bg-primary">
              <Camera className="w-4 h-4 mr-2" /> Adjuntar albarán
            </Button>
          </>
        }
      />

      {/* Header info */}
      <Card className="mb-4">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoBlock label="Proveedor">
            <button
              onClick={() => setView("supplier-detail", { id: order.supplier.id }, order.supplier.name)}
              className="text-primary hover:underline font-medium"
            >
              {order.supplier.name}
            </button>
          </InfoBlock>
          <InfoBlock label="Presupuesto de origen">
            {order.sourcePurchaseQuote ? (
              <button
                onClick={() => setView("purchase-quote-detail", { id: order.sourcePurchaseQuote.id })}
                className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
              >
                <FileText className="w-4 h-4" />
                <span>PQ {shortId(order.sourcePurchaseQuote.id)}</span>
              </button>
            ) : (
              <span className="text-muted-foreground text-sm">Directo (sin presupuesto previo)</span>
            )}
          </InfoBlock>
          <InfoBlock label="Pedido de venta vinculado" highlight>
            {order.saleOrder ? (
              <button
                onClick={() => setView("sale-order-detail", { id: order.saleOrder.id })}
                className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="font-mono">{order.saleOrder.number}</span>
                <span className="text-muted-foreground">· {order.saleOrder.client?.name}</span>
              </button>
            ) : (
              <span className="text-muted-foreground text-sm">Sin pedido de venta</span>
            )}
          </InfoBlock>
          <InfoBlock label="Total / Fecha">
            <div className="text-lg font-bold tabular-nums">{formatCurrency(order.total)}</div>
            <div className="text-xs text-muted-foreground">{formatDate(order.issueDate)}</div>
          </InfoBlock>
        </CardContent>
      </Card>

      {/* Quick link to sale order */}
      {order.saleOrder && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              <span>
                Trazabilidad: este pedido de compra sirve para el pedido de venta{" "}
                <strong className="font-mono">{order.saleOrder.number}</strong>{" "}
                del cliente <strong>{order.saleOrder.client?.name}</strong>.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView("sale-order-detail", { id: order.saleOrder.id })}
            >
              Ir al pedido de venta
              <ShoppingCart className="w-3.5 h-3.5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Líneas (read-only) */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" /> Líneas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {order.lines?.length === 0 ? (
            <div className="px-4 pb-6 text-sm text-muted-foreground">Sin líneas.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Artículo / Descripción</TableHead>
                    <TableHead className="w-[90px] text-right">Cantidad</TableHead>
                    <TableHead className="w-[120px] text-right">Precio unit.</TableHead>
                    <TableHead className="w-[120px] text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.description}</div>
                        {l.article && (
                          <div className="text-xs text-muted-foreground">
                            {l.article.internalCode} · {l.article.name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(l.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(l.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-end px-4 py-3 border-t bg-muted/30">
            <div className="text-lg font-bold tabular-nums">{formatCurrency(order.total)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Albaranes de entrada */}
      <Card className="mb-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="w-4 h-4" /> Albaranes de entrada ({order.albaranes?.length ?? 0})
          </CardTitle>
          <Button size="sm" onClick={() => setShowAlbaranDialog(true)} className="bg-primary">
            <Camera className="w-4 h-4 mr-1" /> Adjuntar albarán
          </Button>
        </CardHeader>
        <CardContent>
          {order.albaranes?.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Llega al almacén del proveedor, haz la foto del albarán y súbela aquí.
              <div className="mt-3">
                <Button onClick={() => setShowAlbaranDialog(true)} className="bg-primary">
                  <Camera className="w-5 h-5 mr-2" /> Adjuntar primer albarán
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {order.albaranes.map((a: any) => (
                <div key={a.id} className="border border-border rounded-md p-3 bg-background">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(a.date)} · subido por {a.uploadedBy?.name ?? "—"}
                      </div>
                      {a.notes && (
                        <div className="text-sm mt-1 whitespace-pre-wrap">{a.notes}</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive h-7"
                      onClick={() => deleteAlbaranMut.mutate(a.id)}
                      disabled={deleteAlbaranMut.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {a.attachments?.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {a.attachments.map((att: any) => (
                        <AttachmentThumb key={att.id} file={att} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">Sin fotos adjuntas</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas */}
      <Card className="mb-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Notas internas</CardTitle>
          <Button
            variant={editingNotes ? "ghost" : "outline"}
            size="sm"
            onClick={() => setEditingNotes((v) => !v)}
          >
            {editingNotes ? <X className="w-4 h-4 mr-1" /> : <Pencil className="w-4 h-4 mr-1" />}
            {editingNotes ? "Cancelar" : "Editar"}
          </Button>
        </CardHeader>
        <CardContent>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notas internas del pedido..."
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => updateMut.mutate({ notes })} disabled={updateMut.isPending}>
                  {updateMut.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {order.notes || <span className="text-muted-foreground">Sin notas.</span>}
            </p>
          )}
        </CardContent>
      </Card>

      <AlbaranDialog
        open={showAlbaranDialog}
        onOpenChange={setShowAlbaranDialog}
        purchaseOrderId={order.id}
        saleOrderId={order.saleOrderId}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["purchase-order", id] });
          qc.invalidateQueries({ queryKey: ["albaranes"] });
          qc.invalidateQueries({ queryKey: ["purchase-orders"] });
        }}
      />
    </div>
  );
}

function InfoBlock({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "rounded-md bg-primary/5 p-3 -m-1" : ""}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

/** Diálogo optimizado para móvil: crea el albarán y permite subir fotos inmediatamente. */
function AlbaranDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  saleOrderId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchaseOrderId: string;
  saleOrderId?: string | null;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [albaran, setAlbaran] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setAlbaran(null);
    setCreating(false);
  };

  const createAlbaran = async () => {
    setCreating(true);
    try {
      const r = await fetch("/api/albaranes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SUPPLIER_IN",
          purchaseOrderId,
          saleOrderId: saleOrderId ?? null,
          date,
          notes: notes || null,
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Error");
      }
      const data = await r.json();
      setAlbaran(data);
      onCreated();
      toast({ title: "Albarán creado. Adjunta las fotos." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const close = () => {
    onOpenChange(false);
    // Si creamos un albarán sin fotos ni notas, borrarlo (limpieza)
    if (albaran && (albaran.attachments?.length ?? 0) === 0 && !albaran.notes) {
      fetch(`/api/albaranes/${albaran.id}`, { method: "DELETE" }).then(() => {
        qc.invalidateQueries({ queryKey: ["purchase-order", purchaseOrderId] });
        qc.invalidateQueries({ queryKey: ["albaranes"] });
      });
    }
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" /> Adjuntar albarán de entrada
          </DialogTitle>
        </DialogHeader>

        {!albaran ? (
          <div className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="ej. falta 1 unidad, embalaje dañado..."
              />
            </div>
            <Button
              onClick={createAlbaran}
              disabled={creating}
              className="w-full h-12 text-base bg-primary"
            >
              {creating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Camera className="w-5 h-5 mr-2" />
              )}
              Crear y hacer fotos
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Crea el registro y luego podrás subir fotos desde la cámara.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Albarán creado el <strong>{formatDateTime(albaran.date)}</strong>. Sube aquí las fotos del albarán del proveedor.
            </div>

            {/* Botones de cámara grandes para móvil */}
            <div className="flex gap-2">
              <AttachmentUploader
                entityType="ALBARAN"
                entityId={albaran.id}
                variant="compact"
                onUploaded={() => {
                  onCreated();
                }}
                className=""
              />
              <Button
                variant="outline"
                onClick={() =>
                  fetch(`/api/albaranes/${albaran.id}`)
                    .then((r) => r.json())
                    .then((updated) => setAlbaran(updated))
                }
              >
                Refrescar
              </Button>
            </div>

            {albaran.attachments?.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {albaran.attachments.map((att: any) => (
                  <AttachmentThumb key={att.id} file={att} />
                ))}
              </div>
            )}

            <DialogFooter>
              <Button onClick={close} className="w-full">
                Listo
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
