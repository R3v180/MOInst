"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { FileText, Plus, Search, Loader2, Truck, ShoppingCart } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function PurchaseQuotesView() {
  const { setView } = useAppStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [supplierId, setSupplierId] = useState("all");
  const [saleOrderId, setSaleOrderId] = useState("all");
  const [status, setStatus] = useState("all");
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-quotes", q, supplierId, saleOrderId, status],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("includeMeta", "1");
      if (q) p.set("q", q);
      if (supplierId !== "all") p.set("supplierId", supplierId);
      if (saleOrderId !== "all") p.set("saleOrderId", saleOrderId);
      if (status !== "all") p.set("status", status);
      const r = await fetch(`/api/purchase-quotes?${p.toString()}`);
      return r.json();
    },
  });

  const items = data?.items ?? [];
  const suppliers = data?.meta?.suppliers ?? [];
  const saleOrders = data?.meta?.saleOrders ?? [];

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/purchase-quotes", {
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
    onSuccess: (quote) => {
      toast({ title: "Presupuesto de compra creado" });
      qc.invalidateQueries({ queryKey: ["purchase-quotes"] });
      setShowNew(false);
      setView("purchase-quote-detail", { id: quote.id });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Presupuestos de compra"
        description={`${data?.total ?? 0} presupuestos recibidos de proveedores`}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo presupuesto de compra
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por proveedor, pedido de venta o notas..."
            className="pl-9"
          />
        </div>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Todos los proveedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proveedores</SelectItem>
            {suppliers.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={saleOrderId} onValueChange={setSaleOrderId}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Todos los pedidos de venta" />
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="RECEIVED">Recibido</SelectItem>
            <SelectItem value="ACCEPTED">Aceptado</SelectItem>
            <SelectItem value="DISCARDED">Descartado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="Sin presupuestos de compra"
          description="Cuando un proveedor te envíe un presupuesto por materiales, reguístrelo aquí para poder generar el pedido de compra."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nuevo presupuesto de compra
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Pedido de venta</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it: any) => (
                  <TableRow
                    key={it.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setView("purchase-quote-detail", { id: it.id })}
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDate(it.issueDate)}
                    </TableCell>
                    <TableCell className="font-medium">{it.supplier?.name ?? "—"}</TableCell>
                    <TableCell>
                      {it.saleOrder ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setView("sale-order-detail", { id: it.saleOrder.id });
                          }}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span className="font-mono">{it.saleOrder.number}</span>
                          <span className="text-muted-foreground">· {it.saleOrder.client?.name}</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin pedido</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(it.total)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="purchaseQuote" value={it.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {it._count?.purchaseOrders > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm text-primary">
                          <Truck className="w-3.5 h-3.5" /> {it._count.purchaseOrders}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <NewPurchaseQuoteDialog
        open={showNew}
        onOpenChange={setShowNew}
        suppliers={suppliers}
        saleOrders={saleOrders}
        onSubmit={(d) => createMut.mutate(d)}
        loading={createMut.isPending}
      />
    </div>
  );
}

function NewPurchaseQuoteDialog({
  open,
  onOpenChange,
  suppliers,
  saleOrders,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suppliers: any[];
  saleOrders: any[];
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [saleOrderId, setSaleOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [issueDate, setIssueDate] = useState("");

  const reset = () => {
    setSupplierId("");
    setSaleOrderId("");
    setNotes("");
    setIssueDate("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo presupuesto de compra</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Proveedor *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona proveedor..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.length === 0 ? (
                  <SelectItem value="-" disabled>No hay proveedores</SelectItem>
                ) : (
                  suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pedido de venta vinculado (opcional)</Label>
            <Select value={saleOrderId} onValueChange={(v) => setSaleOrderId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin pedido de venta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin pedido de venta</SelectItem>
                {saleOrders.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.number} · {s.client?.name ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Vincrulo de trazabilidad: de qué pedido de cliente viene la compra.
            </p>
          </div>
          <div>
            <Label>Fecha de recepción</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Notas internas</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ej. el proveedor ofrece 30 días de pago"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={loading || !supplierId}
            onClick={() =>
              onSubmit({
                supplierId,
                saleOrderId: saleOrderId || null,
                issueDate: issueDate || undefined,
                notes: notes || null,
                lines: [],
              })
            }
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear y editar líneas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
