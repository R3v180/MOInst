"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  Package,
  Pencil,
  Save,
  Loader2,
  Plus,
  Truck,
  LineChart,
  Boxes,
  TriangleAlert,
  ClipboardList,
  FileText,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const TYPE_LABELS: Record<string, string> = {
  SERIALIZED: "Serializado",
  CONSUMABLE: "Consumible",
};

const CHART_COLORS = [
  "#0d9488", // teal-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#dc2626", // red-600
  "#2563eb", // blue-600 — uso interno de gráfico, no de UI general
  "#059669", // emerald-600
  "#c026d3", // fuchsia-600
  "#65a30d", // lime-600
];

export function ArticleDetailView() {
  const { params, setView } = useAppStore();
  const id = params.id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const { data: article, isLoading } = useQuery({
    queryKey: ["article", id],
    queryFn: () => fetch(`/api/articles/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/articles/${id}`, {
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
      toast({ title: "Artículo actualizado" });
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["article", id] });
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addPriceMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/article-suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, articleId: id }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Error");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Precio añadido al histórico" });
      setShowAddSupplier(false);
      qc.invalidateQueries({ queryKey: ["article", id] });
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["price-history", id] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !article) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const openEdit = () => {
    setDraft({
      internalCode: article.internalCode ?? "",
      name: article.name ?? "",
      category: article.category ?? "",
      articleType: article.articleType ?? "CONSUMABLE",
      unit: article.unit ?? "unidad",
      brand: article.brand ?? "",
      description: article.description ?? "",
      stock: article.stock ?? 0,
      stockMin: article.stockMin ?? 0,
    });
    setEditing(true);
  };

  return (
    <div>
      <PageHeader
        title={article.name}
        description={`${article.internalCode} · ${article.brand ?? "Sin marca"}`}
        backTo="articles"
        actions={
          <>
            <Button variant="outline" onClick={openEdit}>
              <Pencil className="w-4 h-4 mr-2" /> Editar
            </Button>
            <Button onClick={() => setShowAddSupplier(true)}>
              <Plus className="w-4 h-4 mr-2" /> Asociar proveedor
            </Button>
          </>
        }
      />

      <Tabs defaultValue="data" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="data">Datos</TabsTrigger>
          <TabsTrigger value="prices">
            Proveedores y precios ({article.currentPrices?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="usage">
            Usado en ({article.saleQuoteLines?.length ?? 0}/{article.saleOrderLines?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Datos */}
        <TabsContent value="data">
          <Card>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:grid-cols-2">
              <Info label="Código interno" value={article.internalCode} />
              <Info label="Tipo" value={TYPE_LABELS[article.articleType] ?? article.articleType} />
              <Info label="Categoría" value={article.category} />
              <Info label="Marca" value={article.brand} icon={<Boxes className="w-4 h-4" />} />
              <Info label="Unidad" value={article.unit} />
              <Info label="Descripción" value={article.description} className="sm:col-span-2" />
              <div className="sm:col-span-2 grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <Info label="Stock actual" value={article.stock} />
                <Info label="Stock mínimo" value={article.stockMin} />
              </div>
              {article.stock <= article.stockMin && (
                <div className="sm:col-span-2 flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-md px-3 py-2">
                  <TriangleAlert className="w-4 h-4" /> Stock igual o por debajo del mínimo
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proveedores y precios */}
        <TabsContent value="prices">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" /> Precios actuales por proveedor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {article.currentPrices?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Proveedor</TableHead>
                        <TableHead className="text-right">Precio actual</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Ref. proveedor</TableHead>
                        <TableHead>Entrega</TableHead>
                        <TableHead className="pr-4">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {article.currentPrices.map((ap: any, idx: number) => (
                        <TableRow key={ap.id} className={idx === 0 ? "bg-primary/5" : ""}>
                          <TableCell className="pl-4 font-medium">
                            <button
                              className="text-left hover:underline"
                              onClick={() => setView("supplier-detail", { id: ap.supplierId })}
                            >
                              {ap.supplier?.name ?? "Proveedor"}
                            </button>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(ap.price)}
                          </TableCell>
                          <TableCell>{formatDate(ap.priceDate)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {ap.supplierRef || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {ap.deliveryDays != null ? `${ap.deliveryDays} días` : "—"}
                          </TableCell>
                          <TableCell className="pr-4">
                            {idx === 0 ? (
                              <Badge className="bg-primary text-primary-foreground">Mejor</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                +{Math.round(ap.price - article.currentPrices[0].price)}€
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState
                    icon={<Truck className="w-6 h-6" />}
                    title="Sin proveedores asociados"
                    description="Asocia un proveedor y registra el precio actual."
                    action={
                      <Button onClick={() => setShowAddSupplier(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Asociar proveedor
                      </Button>
                    }
                    className="py-8"
                  />
                )}
              </CardContent>
            </Card>

            <PriceHistoryCard articleId={id} />
          </div>
        </TabsContent>

        {/* Usado en */}
        <TabsContent value="usage">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <div className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <FileText className="w-4 h-4 text-primary" /> Presupuestos recientes
                </div>
                {article.saleQuoteLines?.length ? (
                  <ul className="divide-y divide-border">
                    {article.saleQuoteLines.map((l: any) => (
                      <li key={l.id}>
                        <button
                          className="w-full text-left py-2 px-2 -mx-2 hover:bg-accent rounded flex items-center gap-3"
                          onClick={() => setView("sale-quote-detail", { id: l.saleQuote?.id })}
                        >
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">
                              {l.saleQuote?.number ?? "—"}
                              {l.saleQuote?.client ? (
                                <span className="text-muted-foreground"> · {l.saleQuote.client.name}</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {l.description} · {l.quantity} × {formatCurrency(l.unitPrice)}
                              {l.discount ? ` (-${l.discount}%)` : ""}
                            </div>
                          </div>
                          <div className="text-sm font-semibold whitespace-nowrap">
                            {formatCurrency(l.subtotal)}
                          </div>
                          {l.saleQuote?.status && (
                            <StatusBadge kind="saleQuote" value={l.saleQuote.status} />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin uso en presupuestos.</p>
                )}
              </div>

              <div className="pt-2 border-t border-border">
                <div className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <ClipboardList className="w-4 h-4 text-primary" /> Pedidos de venta recientes
                </div>
                {article.saleOrderLines?.length ? (
                  <ul className="divide-y divide-border">
                    {article.saleOrderLines.map((l: any) => (
                      <li key={l.id}>
                        <button
                          className="w-full text-left py-2 px-2 -mx-2 hover:bg-accent rounded flex items-center gap-3"
                          onClick={() => setView("sale-order-detail", { id: l.saleOrder?.id })}
                        >
                          <ClipboardList className="w-4 h-4 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">
                              {l.saleOrder?.number ?? "—"}
                              {l.saleOrder?.client ? (
                                <span className="text-muted-foreground"> · {l.saleOrder.client.name}</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {l.description} · {l.quantity} × {formatCurrency(l.unitPrice)}
                            </div>
                          </div>
                          <div className="text-sm font-semibold whitespace-nowrap">
                            {formatCurrency(l.subtotal)}
                          </div>
                          {l.saleOrder?.status && (
                            <StatusBadge kind="saleOrder" value={l.saleOrder.status} />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin uso en pedidos de venta.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
          <DialogHeader>
            <DialogTitle>Editar artículo</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Código interno *</Label>
                  <Input
                    value={draft.internalCode}
                    onChange={(e) => setDraft({ ...draft, internalCode: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={draft.articleType}
                    onValueChange={(v) => setDraft({ ...draft, articleType: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERIALIZED">Serializado</SelectItem>
                      <SelectItem value="CONSUMABLE">Consumible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoría</Label>
                  <Input
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Marca</Label>
                  <Input
                    value={draft.brand}
                    onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Unidad</Label>
                  <Input
                    value={draft.unit}
                    onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={draft.stock}
                    onChange={(e) => setDraft({ ...draft, stock: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Stock mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={draft.stockMin}
                    onChange={(e) => setDraft({ ...draft, stockMin: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
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

      {/* Asociar proveedor */}
      <AddSupplierDialog
        open={showAddSupplier}
        onOpenChange={setShowAddSupplier}
        articleInternalCode={article.internalCode}
        articleName={article.name}
        existingSupplierIds={(article.currentPrices ?? []).map((p: any) => p.supplierId)}
        onSubmit={(payload) => addPriceMut.mutate(payload)}
        loading={addPriceMut.isPending}
      />
    </div>
  );
}

// ─── Sub-componente: histórico de precios con gráfico ──────────────────────
function PriceHistoryCard({ articleId }: { articleId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <LineChart className="w-4 h-4 text-primary" /> Histórico de precios
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <LineChart className="w-4 h-4 mr-2" /> Ver histórico
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">
          Consulta la evolución del precio por proveedor con gráfico y tabla detallada.
        </p>
      </CardContent>

      <PriceHistoryDialog
        open={open}
        onOpenChange={setOpen}
        articleId={articleId}
      />
    </Card>
  );
}

function PriceHistoryDialog({
  open,
  onOpenChange,
  articleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  articleId: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["price-history", articleId],
    queryFn: () => fetch(`/api/articles/${articleId}/price-history`).then((r) => r.json()),
    enabled: open && !!articleId,
  });

  const suppliers = data?.suppliers ?? [];
  const rows = data?.rows ?? [];

  const [off, setOff] = useState<Record<string, boolean>>({});
  const isSelected = (sid: string) => !off[sid];

  // Pivotar datos para recharts: cada priceDate → { date, [supplierId]: price }
  const chartData = useMemo(() => {
    const byDate = new Map<string, any>();
    for (const r of rows) {
      if (off[r.supplierId]) continue;
      const key = new Date(r.priceDate).getTime();
      const entry = byDate.get(key) ?? { ts: key, dateLabel: formatDate(r.priceDate) };
      entry[r.supplierId] = r.price;
      entry[`${r.supplierId}_name`] = r.supplierName;
      byDate.set(key, entry);
    }
    return Array.from(byDate.values()).sort((a, b) => a.ts - b.ts);
  }, [rows, off]);

  const visibleSuppliers = suppliers.filter((s: any) => !off[s.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Histórico de precios</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando histórico...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<LineChart className="w-6 h-6" />}
            title="Sin histórico"
            description="Aún no hay precios registrados para este artículo."
          />
        ) : (
          <div className="space-y-4">
            {/* Filtros por proveedor */}
            <div className="flex flex-wrap gap-3">
              {suppliers.map((s: any) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-sm cursor-pointer border border-border rounded px-2 py-1 hover:bg-accent"
                >
                  <Checkbox
                    checked={isSelected(s.id)}
                    onCheckedChange={(v) =>
                      setOff((p) => {
                        const next = { ...p };
                        if (v) delete next[s.id];
                        else next[s.id] = true;
                        return next;
                      })
                    }
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>

            {/* Gráfico */}
            {visibleSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Selecciona al menos un proveedor para ver el gráfico.
              </p>
            ) : (
              <div className="h-72 w-full border border-border rounded-md p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ReLineChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 11 }}
                      className="text-xs"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${Number(v).toFixed(0)}€`}
                    />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value))}
                      labelStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {visibleSuppliers.map((s: any, idx: number) => (
                      <Line
                        key={s.id}
                        type="monotone"
                        dataKey={s.id}
                        name={s.name}
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                        connectNulls
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </ReLineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabla */}
            <div className="border border-border rounded-md max-h-72 overflow-y-auto scroll-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="pl-3">Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Ref.</TableHead>
                    <TableHead className="pr-3">Entrega</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rows].reverse().map((r: any) => (
                    <TableRow
                      key={r.id}
                      className={isSelected(r.supplierId) ? "" : "opacity-40"}
                    >
                      <TableCell className="pl-3 whitespace-nowrap">
                        {formatDateTime(r.priceDate)}
                      </TableCell>
                      <TableCell>{r.supplierName}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(r.price)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.supplierRef || "—"}
                      </TableCell>
                      <TableCell className="pr-3 text-muted-foreground">
                        {r.deliveryDays != null ? `${r.deliveryDays} días` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-componente: asociar proveedor + precio ─────────────────────────────
function AddSupplierDialog({
  open,
  onOpenChange,
  articleInternalCode,
  articleName,
  existingSupplierIds,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  articleInternalCode: string;
  articleName: string;
  existingSupplierIds: string[];
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [q, setQ] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [d, setD] = useState<any>({});
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }));

  const { data: suppliersData, isLoading } = useQuery({
    queryKey: ["suppliers", q, "for-article"],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      p.set("pageSize", "50");
      const r = await fetch(`/api/suppliers?${p.toString()}`);
      return r.json();
    },
    enabled: open,
  });

  const reset = () => {
    setQ("");
    setSelectedSupplier("");
    setD({});
  };

  const submit = () => {
    if (!selectedSupplier) {
      toast({ title: "Selecciona un proveedor", variant: "destructive" });
      return;
    }
    if (d.price == null || Number(d.price) < 0) {
      toast({ title: "Precio inválido", variant: "destructive" });
      return;
    }
    onSubmit({
      supplierId: selectedSupplier,
      price: Number(d.price),
      supplierRef: d.supplierRef ?? null,
      deliveryDays: d.deliveryDays ? Number(d.deliveryDays) : null,
      notes: d.notes ?? null,
    });
    reset();
  };

  const suppliers = (suppliersData?.items ?? []).filter(
    (s: any) => !existingSupplierIds.includes(s.id)
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Asociar proveedor y precio</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          Artículo: <span className="font-medium text-foreground">{articleName}</span>{" "}
          <span className="font-mono">({articleInternalCode})</span>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Buscar proveedor</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre o contacto..."
            />
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-2">Cargando...</div>
          ) : suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No hay proveedores disponibles. Crea primero el proveedor.
            </p>
          ) : (
            <div className="border border-border rounded-md max-h-48 overflow-y-auto scroll-thin">
              {suppliers.map((s: any) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
                >
                  <input
                    type="radio"
                    name="supplier"
                    checked={selectedSupplier === s.id}
                    onChange={() => setSelectedSupplier(s.id)}
                  />
                  <span className="font-medium text-sm">{s.name}</span>
                  {s.contactName && (
                    <span className="text-xs text-muted-foreground">· {s.contactName}</span>
                  )}
                </label>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Precio (€) *</Label>
              <Input
                type="number"
                step="0.01"
                value={d.price ?? ""}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Días entrega</Label>
              <Input
                type="number"
                value={d.deliveryDays ?? ""}
                onChange={(e) => set("deliveryDays", e.target.value)}
                placeholder="ej. 3"
              />
            </div>
            <div>
              <Label>Ref. proveedor</Label>
              <Input
                value={d.supplierRef ?? ""}
                onChange={(e) => set("supplierRef", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea
              rows={2}
              value={d.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="ej. oferta válida hasta fin de mes"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se añadirá una nueva fila al histórico (no se sobrescriben precios anteriores).
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Añadir precio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value?: string | number | null;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
