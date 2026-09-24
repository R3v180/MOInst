"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AttachmentUploader,
  AttachmentThumb,
} from "@/components/shared/attachment-uploader";
import { formatDateTime, formatDate } from "@/lib/format";
import {
  Truck,
  PackageOpen,
  Plus,
  Loader2,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

export function AlbaranesView() {
  const { setView } = useAppStore();
  const qc = useQueryClient();
  const [type, setType] = useState("all");
  const [linkedId, setLinkedId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["albaranes", type, linkedId, dateFrom, dateTo],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("includeMeta", "1");
      if (type !== "all") p.set("type", type);
      if (linkedId !== "all") {
        if (type === "SUPPLIER_IN" || type === "all") p.set("purchaseOrderId", linkedId);
        else p.set("saleOrderId", linkedId);
      }
      if (dateFrom) p.set("dateFrom", dateFrom);
      if (dateTo) p.set("dateTo", dateTo);
      const r = await fetch(`/api/albaranes?${p.toString()}`);
      return r.json();
    },
  });

  const items = data?.items ?? [];
  const purchaseOrders = data?.meta?.purchaseOrders ?? [];
  const saleOrders = data?.meta?.saleOrders ?? [];

  // Detalle
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["albaran", detailId],
    queryFn: async () => {
      const r = await fetch(`/api/albaranes/${detailId}`);
      return r.json();
    },
    enabled: !!detailId,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/albaranes/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Error al borrar");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Albarán eliminado" });
      qc.invalidateQueries({ queryKey: ["albaranes"] });
      setDetailId(null);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Filtros dinámicos según tipo
  const showPurchaseOrderFilter = type === "all" || type === "SUPPLIER_IN";
  const showSaleOrderFilter = type === "all" || type === "CLIENT_DELIVERY";

  return (
    <div>
      <PageHeader
        title="Albaranes"
        description={`${data?.total ?? 0} albaranes de entrada / entrega`}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo albarán
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-wrap">
        <Select value={type} onValueChange={(v) => { setType(v); setLinkedId("all"); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="SUPPLIER_IN">Entrada de proveedor</SelectItem>
            <SelectItem value="CLIENT_DELIVERY">Entrega a cliente</SelectItem>
          </SelectContent>
        </Select>
        {showPurchaseOrderFilter && (
          <Select value={showSaleOrderFilter && type === "all" ? "all" : linkedId} onValueChange={setLinkedId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Pedido de compra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pedidos de compra</SelectItem>
              {purchaseOrders.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.number} · {p.supplier?.name ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {showSaleOrderFilter && (
          <Select value={showPurchaseOrderFilter && type === "all" ? "all" : linkedId} onValueChange={setLinkedId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Pedido de venta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pedidos de venta</SelectItem>
              {saleOrders.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.number} · {s.client?.name ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-40" />
          <span className="text-muted-foreground text-sm">→</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-40" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-full mt-2" />
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="Sin albaranes"
          description="Los albaranes son los documentos de entrada (proveedor) o entrega (cliente)."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nuevo albarán
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a: any) => (
            <button key={a.id} onClick={() => setDetailId(a.id)} className="text-left">
              <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <Badge
                      variant="outline"
                      className={
                        a.type === "SUPPLIER_IN"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      }
                    >
                      {a.type === "SUPPLIER_IN" ? (
                        <>
                          <Truck className="w-3 h-3 mr-1" /> Entrada proveedor
                        </>
                      ) : (
                        <>
                          <PackageOpen className="w-3 h-3 mr-1" /> Entrega cliente
                        </>
                      )}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(a.date)}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {a.type === "SUPPLIER_IN" && a.purchaseOrder && (
                      <div>
                        <span className="text-muted-foreground">Pedido: </span>
                        <span className="font-mono font-medium">{a.purchaseOrder.number}</span>
                      </div>
                    )}
                    {a.type === "SUPPLIER_IN" && a.purchaseOrder?.supplier && (
                      <div className="text-muted-foreground text-xs">
                        {a.purchaseOrder.supplier.name}
                      </div>
                    )}
                    {a.type === "CLIENT_DELIVERY" && a.saleOrder && (
                      <div>
                        <span className="text-muted-foreground">Pedido venta: </span>
                        <span className="font-mono font-medium">{a.saleOrder.number}</span>
                      </div>
                    )}
                    {a.type === "CLIENT_DELIVERY" && a.saleOrder?.client && (
                      <div className="text-muted-foreground text-xs">
                        {a.saleOrder.client.name}
                      </div>
                    )}
                  </div>
                  {a.notes && (
                    <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {a.notes}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ImageIcon className="w-3.5 h-3.5" />
                      {(a.attachments?.length ?? 0)} foto(s)
                    </span>
                    <span className="text-muted-foreground">por {a.uploadedBy?.name ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Detalle dialog */}
      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : detail ? (
                <>
                  <Badge
                    variant="outline"
                    className={
                      detail.type === "SUPPLIER_IN"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }
                  >
                    {detail.type === "SUPPLIER_IN" ? "Entrada proveedor" : "Entrega cliente"}
                  </Badge>
                  <span>{formatDateTime(detail.date)}</span>
                </>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                {detail.type === "SUPPLIER_IN" && detail.purchaseOrder && (
                  <div>
                    <span className="text-muted-foreground">Pedido de compra: </span>
                    <button
                      onClick={() => {
                        setView("purchase-order-detail", { id: detail.purchaseOrder.id });
                        setDetailId(null);
                      }}
                      className="text-primary hover:underline font-mono"
                    >
                      {detail.purchaseOrder.number}
                    </button>{" "}
                    · {detail.purchaseOrder.supplier?.name}
                  </div>
                )}
                {detail.type === "CLIENT_DELIVERY" && detail.saleOrder && (
                  <div>
                    <span className="text-muted-foreground">Pedido de venta: </span>
                    <button
                      onClick={() => {
                        setView("sale-order-detail", { id: detail.saleOrder.id });
                        setDetailId(null);
                      }}
                      className="text-primary hover:underline font-mono"
                    >
                      {detail.saleOrder.number}
                    </button>{" "}
                    · {detail.saleOrder.client?.name}
                  </div>
                )}
                <div className="text-muted-foreground">
                  Subido por {detail.uploadedBy?.name ?? "—"} · {formatDateTime(detail.date)}
                </div>
              </div>
              {detail.notes && (
                <div className="text-sm whitespace-pre-wrap border-l-2 border-primary/40 pl-3">
                  {detail.notes}
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Fotos adjuntas ({detail.attachments?.length ?? 0})</Label>
                {detail.attachments?.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                    {detail.attachments.map((att: any) => (
                      <AttachmentThumb key={att.id} file={att} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic mt-1">Sin fotos.</div>
                )}
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMut.mutate(detail.id)}
                  disabled={deleteMut.isPending}
                >
                  {deleteMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Eliminar albarán
                </Button>
                <Button variant="outline" onClick={() => setDetailId(null)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NewAlbaranDialog
        open={showNew}
        onOpenChange={setShowNew}
        purchaseOrders={purchaseOrders}
        saleOrders={saleOrders}
        onCreated={(alb) => {
          qc.invalidateQueries({ queryKey: ["albaranes"] });
          setShowNew(false);
          setDetailId(alb.id);
        }}
      />
    </div>
  );
}

function NewAlbaranDialog({
  open,
  onOpenChange,
  purchaseOrders,
  saleOrders,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchaseOrders: any[];
  saleOrders: any[];
  onCreated: (alb: any) => void;
}) {
  const [type, setType] = useState<"SUPPLIER_IN" | "CLIENT_DELIVERY">("SUPPLIER_IN");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [saleOrderId, setSaleOrderId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<any>(null);

  const reset = () => {
    setType("SUPPLIER_IN");
    setPurchaseOrderId("");
    setSaleOrderId("");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setCreating(false);
    setCreated(null);
  };

  const submit = async () => {
    setCreating(true);
    try {
      const r = await fetch("/api/albaranes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          purchaseOrderId: type === "SUPPLIER_IN" ? purchaseOrderId || null : null,
          saleOrderId: type === "CLIENT_DELIVERY" ? saleOrderId || null : null,
          date,
          notes: notes || null,
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Error");
      }
      const data = await r.json();
      setCreated(data);
      toast({ title: "Albarán creado. Sube fotos si quieres." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const close = () => {
    if (created) {
      onCreated(created);
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" /> Nuevo albarán
          </DialogTitle>
        </DialogHeader>
        {!created ? (
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPPLIER_IN">Entrada de proveedor</SelectItem>
                  <SelectItem value="CLIENT_DELIVERY">Entrega a cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "SUPPLIER_IN" && (
              <div>
                <Label>Pedido de compra *</Label>
                <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona pedido..." />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseOrders.length === 0 ? (
                      <SelectItem value="-" disabled>No hay pedidos</SelectItem>
                    ) : (
                      purchaseOrders.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.number} · {p.supplier?.name ?? "—"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {type === "CLIENT_DELIVERY" && (
              <div>
                <Label>Pedido de venta *</Label>
                <Select value={saleOrderId} onValueChange={setSaleOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona pedido..." />
                  </SelectTrigger>
                  <SelectContent>
                    {saleOrders.length === 0 ? (
                      <SelectItem value="-" disabled>No hay pedidos</SelectItem>
                    ) : (
                      saleOrders.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.number} · {s.client?.name ?? "—"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notas internas del albarán..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                onClick={submit}
                disabled={creating || (type === "SUPPLIER_IN" && !purchaseOrderId) || (type === "CLIENT_DELIVERY" && !saleOrderId)}
              >
                {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Crear y adjuntar fotos
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Albarán creado. Sube aquí las fotos del documento.
            </div>
            <div className="flex gap-2">
              <AttachmentUploader
                entityType="ALBARAN"
                entityId={created.id}
                variant="compact"
              />
            </div>
            {created.attachments?.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {created.attachments.map((att: any) => (
                  <AttachmentThumb key={att.id} file={att} />
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={close} className="w-full">Listo</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
