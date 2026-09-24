"use client";

import { useState, useEffect, useMemo } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AttachmentUploader,
  AttachmentThumb,
} from "@/components/shared/attachment-uploader";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  ChevronDown,
  Trash2,
  Plus,
  Save,
  X,
  Pencil,
  FileText,
  Truck,
  ShoppingCart,
  CheckCircle2,
  Loader2,
  Package,
  Search,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

type Line = {
  id?: string;
  articleId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
};

export function PurchaseQuoteDetailView() {
  const { params, setView } = useAppStore();
  const id = params.id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [issueDate, setIssueDate] = useState("");

  const { data: quote, isLoading } = useQuery({
    queryKey: ["purchase-quote", id],
    queryFn: async () => {
      const r = await fetch(`/api/purchase-quotes/${id}`);
      if (!r.ok) throw new Error("Error al cargar");
      return r.json();
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (quote) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes(quote.notes ?? "");
      setIssueDate(quote.issueDate ? quote.issueDate.slice(0, 10) : "");
      setLines(
        (quote.lines ?? []).map((l: any) => ({
          id: l.id,
          articleId: l.articleId ?? null,
          description: l.description ?? "",
          quantity: Number(l.quantity) ?? 0,
          unitPrice: Number(l.unitPrice) ?? 0,
          sortOrder: l.sortOrder ?? 0,
        }))
      );
    }
  }, [quote]);

  const total = useMemo(
    () => round2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)),
    [lines]
  );

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/purchase-quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Error al guardar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Presupuesto actualizado" });
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["purchase-quote", id] });
      qc.invalidateQueries({ queryKey: ["purchase-quotes"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMut = useMutation({
    mutationFn: async (status: string) => {
      const r = await fetch(`/api/purchase-quotes/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Error");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Estado actualizado" });
      qc.invalidateQueries({ queryKey: ["purchase-quote", id] });
      qc.invalidateQueries({ queryKey: ["purchase-quotes"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateOrderMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/purchase-quotes/${id}/generate-order`, {
        method: "POST",
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Error al generar pedido");
      }
      return r.json();
    },
    onSuccess: (order) => {
      toast({
        title: "Pedido de compra generado",
        description: order.number,
      });
      qc.invalidateQueries({ queryKey: ["purchase-quote", id] });
      qc.invalidateQueries({ queryKey: ["purchase-quotes"] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      setView("purchase-order-detail", { id: order.id });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAttachmentMut = useMutation({
    mutationFn: async (attId: string) => {
      const r = await fetch(`/api/attachments/${attId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Error al borrar");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Documento eliminado" });
      qc.invalidateQueries({ queryKey: ["purchase-quote", id] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !quote) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const addLine = () => {
    setLines((arr) => [
      ...arr,
      {
        articleId: null,
        description: "",
        quantity: 1,
        unitPrice: 0,
        sortOrder: arr.length,
      },
    ]);
  };
  const removeLine = (idx: number) => {
    setLines((arr) => arr.filter((_, i) => i !== idx));
  };

  const save = () => {
    updateMut.mutate({
      notes: notes || null,
      issueDate: issueDate || undefined,
      lines: lines.map((l, idx) => ({
        id: l.id,
        articleId: l.articleId ?? null,
        description: l.description || "—",
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        sortOrder: idx,
      })),
    });
  };

  return (
    <div>
      <PageHeader
        title={`Presupuesto de compra ${shortId(quote.id)}`}
        description={`Recibido ${formatDateTime(quote.issueDate)} · ${quote.createdBy?.name ?? ""}`}
        backTo="purchase-quotes"
        actions={
          <>
            <Button
              variant={quote.status === "ACCEPTED" ? "default" : "outline"}
              onClick={() => statusMut.mutate("ACCEPTED")}
              disabled={quote.status === "ACCEPTED" || statusMut.isPending}
            >
              {statusMut.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Marcar aceptado
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (quote.status === "ACCEPTED") {
                  generateOrderMut.mutate();
                } else {
                  toast({
                    title: "Marca el presupuesto como aceptado primero",
                    description: "Solo los presupuestos aceptados pueden generar pedido.",
                    variant: "destructive",
                  });
                }
              }}
              disabled={generateOrderMut.isPending}
            >
              {generateOrderMut.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Truck className="w-4 h-4 mr-2" />
              )}
              Generar pedido de compra
            </Button>
            <Button variant={editing ? "default" : "outline"} onClick={() => setEditing((v) => !v)}>
              {editing ? <X className="w-4 h-4 mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
              {editing ? "Cancelar edición" : "Editar"}
            </Button>
          </>
        }
      />

      {/* Header info */}
      <Card className="mb-4">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoBlock label="Proveedor">
            <button
              onClick={() => setView("supplier-detail", { id: quote.supplier.id })}
              className="text-primary hover:underline font-medium"
            >
              {quote.supplier.name}
            </button>
            {quote.supplier.contactName && (
              <div className="text-xs text-muted-foreground">{quote.supplier.contactName}</div>
            )}
          </InfoBlock>
          <InfoBlock label="Pedido de venta vinculado" highlight>
            {quote.saleOrder ? (
              <button
                onClick={() => setView("sale-order-detail", { id: quote.saleOrder.id })}
                className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="font-mono">{quote.saleOrder.number}</span>
                <span className="text-muted-foreground">· {quote.saleOrder.client?.name}</span>
              </button>
            ) : (
              <span className="text-muted-foreground text-sm">Sin pedido de venta</span>
            )}
          </InfoBlock>
          <InfoBlock label="Fecha">
            {editing ? (
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="max-w-[180px]"
              />
            ) : (
              <span className="font-medium">{formatDateTime(quote.issueDate)}</span>
            )}
          </InfoBlock>
          <InfoBlock label="Estado">
            <div className="flex items-center gap-2">
              <StatusBadge kind="purchaseQuote" value={quote.status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => statusMut.mutate("RECEIVED")}>
                    Recibido
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => statusMut.mutate("ACCEPTED")}>
                    Aceptado
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => statusMut.mutate("DISCARDED")}>
                    Descartado
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </InfoBlock>
        </CardContent>
      </Card>

      {/* Líneas */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Líneas
            </span>
            {editing && (
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="w-4 h-4 mr-1" /> Añadir línea
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <div className="px-4 pb-6 text-sm text-muted-foreground">
              {editing
                ? "Pulsa \"Añadir línea\" para añadir artículos o conceptos."
                : "Sin líneas. Pulsa Editar para añadir."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Artículo / Descripción</TableHead>
                    <TableHead className="w-[90px] text-right">Cantidad</TableHead>
                    <TableHead className="w-[120px] text-right">Precio unit.</TableHead>
                    <TableHead className="w-[120px] text-right">Subtotal</TableHead>
                    {editing && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, idx) => (
                    <TableRow key={l.id ?? `new-${idx}`}>
                      <TableCell>
                        {editing ? (
                          <ArticlePicker
                            value={l.description}
                            articleId={l.articleId}
                            onChange={(patch) => updateLine(idx, patch)}
                          />
                        ) : (
                          <div>
                            <div className="font-medium">{l.description}</div>
                            {l.articleId && (
                              <div className="text-xs text-muted-foreground">Artículo vinculado</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 text-right ml-auto"
                          />
                        ) : (
                          <span className="tabular-nums">{l.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={l.unitPrice}
                            onChange={(e) =>
                              updateLine(idx, { unitPrice: parseFloat(e.target.value) || 0 })
                            }
                            className="w-24 text-right ml-auto"
                          />
                        ) : (
                          <span className="tabular-nums">{formatCurrency(l.unitPrice)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(round2((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)))}
                      </TableCell>
                      {editing && (
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeLine(idx)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {editing && (
            <div className="flex justify-end gap-2 p-3 border-t bg-muted/30">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button onClick={save} disabled={updateMut.isPending}>
                {updateMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" /> Guardar cambios
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totales + notas + documento */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{formatCurrency(quote.total)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {editing ? `Calculado en cliente: ${formatCurrency(total)}` : "Suma de subtotales"}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Documento del proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-3">
              <AttachmentUploader
                entityType="PURCHASE_QUOTE"
                entityId={quote.id}
                onUploaded={() => qc.invalidateQueries({ queryKey: ["purchase-quote", id] })}
                accept="image/*,application/pdf"
                label="Adjuntar documento"
              />
            </div>
            {quote.attachments?.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {quote.attachments.map((a: any) => (
                  <AttachmentThumb
                    key={a.id}
                    file={a}
                    onDelete={() => deleteAttachmentMut.mutate(a.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Sube aquí el PDF o foto del presupuesto que envió el proveedor.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Notas internas</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="ej. el proveedor ofrece 30 días de pago / 5% descuento por volumen..."
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {quote.notes || <span className="text-muted-foreground">Sin notas.</span>}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pedidos de compra generados */}
      {quote.purchaseOrders?.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4" /> Pedidos de compra generados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.purchaseOrders.map((po: any) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono">{po.number}</TableCell>
                    <TableCell>{formatDateTime(po.issueDate)}</TableCell>
                    <TableCell><StatusBadge kind="purchaseOrder" value={po.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setView("purchase-order-detail", { id: po.id })}>
                        Ver pedido
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
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

/** Componente: autocompletar de artículos con búsqueda por nombre o texto libre. */
function ArticlePicker({
  value,
  articleId,
  onChange,
}: {
  value: string;
  articleId: string | null;
  onChange: (patch: { description: string; articleId: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const { data } = useQuery({
    queryKey: ["articles-autocomplete", searchQ],
    queryFn: async () => {
      const r = await fetch(`/api/articles?pageSize=10${searchQ ? `&q=${encodeURIComponent(searchQ)}` : ""}`);
      return r.json();
    },
    enabled: open,
  });

  return (
    <div className="flex items-start gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-left text-xs px-1.5 py-1 rounded border border-dashed border-border hover:border-primary/40 text-muted-foreground"
            title="Buscar artículo del catálogo"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="Buscar artículo..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto scroll-thin">
            {(data?.items ?? []).length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">Sin resultados. Puedes escribir texto libre.</div>
            ) : (
              (data?.items ?? []).map((a: any) => (
                <button
                  key={a.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                  onClick={() => {
                    onChange({ description: `${a.name}${a.brand ? ` · ${a.brand}` : ""}`, articleId: a.id });
                    setOpen(false);
                  }}
                >
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.internalCode} · {a.category}
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Input
        value={value}
        onChange={(e) => {
          onChange({ description: e.target.value, articleId: null });
        }}
        placeholder="Artículo o descripción libre..."
      />
    </div>
  );
}
