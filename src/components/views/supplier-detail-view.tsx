"use client";

import { useMemo, useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  Truck,
  Plus,
  Pencil,
  Save,
  Loader2,
  Phone,
  Mail,
  MapPin,
  User,
  Package,
  LineChart,
  Search,
  Trash2,
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
} from "recharts";

export function SupplierDetailView() {
  const { params, setView } = useAppStore();
  const id = params.id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [showAddArticle, setShowAddArticle] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => fetch(`/api/suppliers/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/suppliers/${id}`, {
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
      toast({ title: "Proveedor actualizado" });
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["supplier", id] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addArticleMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/suppliers/${id}/articles`, {
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
    onSuccess: () => {
      toast({ title: "Artículo asociado con precio" });
      setShowAddArticle(false);
      qc.invalidateQueries({ queryKey: ["supplier", id] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al eliminar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Proveedor eliminado" });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
      setView("suppliers");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !supplier) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const openEdit = () => {
    setDraft({
      name: supplier.name ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      contactName: supplier.contactName ?? "",
      notes: supplier.notes ?? "",
    });
    setEditing(true);
  };

  const currentPrices = supplier.currentPrices ?? [];
  const historyCount: Record<string, number> = supplier.historyCount ?? {};

  return (
    <div>
      <PageHeader
        title={supplier.name}
        description={`${currentPrices.length} artículos asociados`}
        backTo="suppliers"
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
                  <AlertDialogTitle>Eliminar proveedor</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Eliminar el proveedor <strong>{supplier.name}</strong>? Esta acción no se puede deshacer.
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
            <Button onClick={() => setShowAddArticle(true)}>
              <Plus className="w-4 h-4 mr-2" /> Añadir artículo
            </Button>
          </>
        }
      />

      <Tabs defaultValue="data" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="data">Datos</TabsTrigger>
          <TabsTrigger value="articles">Artículos ({currentPrices.length})</TabsTrigger>
        </TabsList>

        {/* Datos */}
        <TabsContent value="data">
          <Card>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:grid-cols-2">
              <Info label="Nombre / Razón social" value={supplier.name} />
              <Info label="Persona de contacto" value={supplier.contactName} icon={<User className="w-4 h-4" />} />
              <Info label="Teléfono" value={supplier.phone} icon={<Phone className="w-4 h-4" />} />
              <Info label="Email" value={supplier.email} icon={<Mail className="w-4 h-4" />} />
              <Info label="Dirección" value={supplier.address} icon={<MapPin className="w-4 h-4" />} className="sm:col-span-2" />
              <Info label="Notas internas" value={supplier.notes} className="sm:col-span-2" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Artículos */}
        <TabsContent value="articles">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Artículos de este proveedor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {currentPrices.length === 0 ? (
                <EmptyState
                  icon={<Package className="w-6 h-6" />}
                  title="Sin artículos"
                  description="Añade un artículo con su precio actual para empezar el histórico."
                  action={
                    <Button onClick={() => setShowAddArticle(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Añadir artículo
                    </Button>
                  }
                  className="py-8"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Artículo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Precio actual</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Ref.</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead className="text-center">Hist.</TableHead>
                      <TableHead className="pr-4 text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPrices.map((ap: any) => (
                      <TableRow key={ap.id}>
                        <TableCell className="pl-4">
                          <button
                            className="text-left hover:underline font-medium"
                            onClick={() => setView("article-detail", { id: ap.articleId })}
                          >
                            {ap.article?.name ?? "—"}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {ap.article?.internalCode ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ap.article?.category ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(ap.price)}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDate(ap.priceDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ap.supplierRef || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ap.deliveryDays != null ? `${ap.deliveryDays} días` : "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {historyCount[ap.articleId] ?? 1}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <ArticleHistoryButton
                            supplierId={id}
                            supplierName={supplier.name}
                            articleId={ap.articleId}
                            articleName={ap.article?.name}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto scroll-thin">
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label>Nombre / Razón social *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Dirección</Label>
                <Input
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                />
              </div>
              <div>
                <Label>Persona de contacto</Label>
                <Input
                  value={draft.contactName}
                  onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                />
              </div>
              <div>
                <Label>Notas internas</Label>
                <Textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
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

      {/* Añadir artículo */}
      <AddArticleDialog
        open={showAddArticle}
        onOpenChange={setShowAddArticle}
        supplierId={id}
        supplierName={supplier.name}
        existingArticleIds={currentPrices.map((p: any) => p.articleId)}
        onSubmit={(payload) => addArticleMut.mutate(payload)}
        loading={addArticleMut.isPending}
      />
    </div>
  );
}

// ─── Botón + diálogo: histórico de precios para artículo+proveedor concreto ──
function ArticleHistoryButton({
  supplierId,
  supplierName,
  articleId,
  articleName,
}: {
  supplierId: string;
  supplierName: string;
  articleId: string;
  articleName?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <LineChart className="w-4 h-4 mr-1" /> Ver histórico
      </Button>
      <ArticleSupplierHistoryDialog
        open={open}
        onOpenChange={setOpen}
        articleId={articleId}
        supplierId={supplierId}
        supplierName={supplierName}
        articleName={articleName}
      />
    </>
  );
}

function ArticleSupplierHistoryDialog({
  open,
  onOpenChange,
  articleId,
  supplierId,
  supplierName,
  articleName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  articleId: string;
  supplierId: string;
  supplierName: string;
  articleName?: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["price-history", articleId],
    queryFn: () => fetch(`/api/articles/${articleId}/price-history`).then((r) => r.json()),
    enabled: open && !!articleId,
  });

  // Filtrar sólo las filas de este proveedor, ordenadas asc
  const rows: any[] = useMemo(() => {
    const all = data?.rows ?? [];
    return all
      .filter((r: any) => r.supplierId === supplierId)
      .sort((a: any, b: any) => new Date(a.priceDate).getTime() - new Date(b.priceDate).getTime());
  }, [data, supplierId]);

  const chartData = rows.map((r) => ({
    dateLabel: formatDate(r.priceDate),
    price: r.price,
    ts: new Date(r.priceDate).getTime(),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Histórico de precios</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{articleName ?? "Artículo"}</span>{" "}
          · proveedor <span className="font-medium text-foreground">{supplierName}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<LineChart className="w-6 h-6" />}
            title="Sin histórico"
            description="No hay precios registrados para este artículo y proveedor."
          />
        ) : (
          <div className="space-y-4">
            <div className="h-56 w-full border border-border rounded-md p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${Number(v).toFixed(0)}€`}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value))}
                    labelStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    name="Precio"
                    stroke="#0d9488"
                    connectNulls
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </ReLineChart>
              </ResponsiveContainer>
            </div>

            <div className="border border-border rounded-md max-h-60 overflow-y-auto scroll-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="pl-3">Fecha</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Ref.</TableHead>
                    <TableHead className="pr-3">Entrega</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rows].reverse().map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-3 whitespace-nowrap">
                        {formatDateTime(r.priceDate)}
                      </TableCell>
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

// ─── Añadir artículo: buscar existente o crear nuevo ──────────────────────
function AddArticleDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  existingArticleIds,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplierId: string;
  supplierName: string;
  existingArticleIds: string[];
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [mode, setMode] = useState<"search" | "create">("search");
  const [q, setQ] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<string>("");
  const [d, setD] = useState<any>({});
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }));

  const { data: articlesData, isLoading } = useQuery({
    queryKey: ["articles", q, "for-supplier"],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      p.set("pageSize", "50");
      const r = await fetch(`/api/articles?${p.toString()}`);
      return r.json();
    },
    enabled: open && mode === "search",
  });

  // Categorías para el selector del nuevo artículo
  const [categories, setCategories] = useState<string[]>([]);
  useQuery({
    queryKey: ["articles-categories-supplier"],
    queryFn: async () => {
      const r = await fetch(`/api/articles?page=1&pageSize=1`);
      const j = await r.json();
      setCategories(j.categories ?? []);
      return j.categories;
    },
  });

  const reset = () => {
    setMode("search");
    setQ("");
    setSelectedArticle("");
    setD({});
  };

  const submit = () => {
    if (mode === "search") {
      if (!selectedArticle) {
        toast({ title: "Selecciona un artículo", variant: "destructive" });
        return;
      }
      if (d.price == null || Number(d.price) < 0) {
        toast({ title: "Precio inválido", variant: "destructive" });
        return;
      }
      onSubmit({
        articleId: selectedArticle,
        price: Number(d.price),
        supplierRef: d.supplierRef ?? null,
        deliveryDays: d.deliveryDays ? Number(d.deliveryDays) : null,
        notes: d.notes ?? null,
      });
      reset();
    } else {
      // Crear artículo nuevo y luego asociar
      if (!d.newName || !d.newInternalCode || !d.newCategory) {
        toast({ title: "Faltan datos del artículo", variant: "destructive" });
        return;
      }
      if (d.price == null || Number(d.price) < 0) {
        toast({ title: "Precio inválido", variant: "destructive" });
        return;
      }
      createArticleThenAssociate({
        supplierId,
        article: {
          internalCode: d.newInternalCode,
          name: d.newName,
          category: d.newCategory,
          articleType: d.newArticleType ?? "CONSUMABLE",
          unit: d.newUnit ?? "unidad",
          brand: d.newBrand ?? null,
        },
        priceData: {
          price: Number(d.price),
          supplierRef: d.supplierRef ?? null,
          deliveryDays: d.deliveryDays ? Number(d.deliveryDays) : null,
          notes: d.notes ?? null,
        },
        onSubmit,
        onDone: reset,
      });
    }
  };

  const articles = (articlesData?.items ?? []).filter(
    (a: any) => !existingArticleIds.includes(a.id)
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
          <DialogTitle>Añadir artículo a {supplierName}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={mode === "search" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("search")}
          >
            <Search className="w-4 h-4 mr-1" /> Buscar existente
          </Button>
          <Button
            variant={mode === "create" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("create")}
          >
            <Plus className="w-4 h-4 mr-1" /> Crear nuevo
          </Button>
        </div>

        {mode === "search" ? (
          <div className="space-y-3">
            <div>
              <Label>Buscar artículo</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, código interno o marca..."
              />
            </div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-2">Cargando...</div>
            ) : articles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No hay artículos disponibles (todos ya están asociados o sin coincidencias).
              </p>
            ) : (
              <div className="border border-border rounded-md max-h-48 overflow-y-auto scroll-thin">
                {articles.map((a: any) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
                  >
                    <input
                      type="radio"
                      name="article"
                      checked={selectedArticle === a.id}
                      onChange={() => setSelectedArticle(a.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {a.internalCode} · {a.category}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código interno *</Label>
                <Input
                  value={d.newInternalCode ?? ""}
                  onChange={(e) => set("newInternalCode", e.target.value)}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={d.newArticleType ?? "CONSUMABLE"}
                  onValueChange={(v) => set("newArticleType", v)}
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
                value={d.newName ?? ""}
                onChange={(e) => set("newName", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría *</Label>
                <Input
                  list="cat-list"
                  value={d.newCategory ?? ""}
                  onChange={(e) => set("newCategory", e.target.value)}
                  placeholder="Escribe o selecciona"
                />
                <datalist id="cat-list">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Marca</Label>
                <Input
                  value={d.newBrand ?? ""}
                  onChange={(e) => set("newBrand", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Unidad</Label>
              <Input
                value={d.newUnit ?? "unidad"}
                onChange={(e) => set("newUnit", e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
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
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Se añadirá una nueva fila al histórico (no se sobrescriben precios anteriores).
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Añadir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper inline: crea el artículo y luego lo asocia al proveedor (mutation externa)
async function createArticleThenAssociate({
  supplierId,
  article,
  priceData,
  onSubmit,
  onDone,
}: {
  supplierId: string;
  article: any;
  priceData: any;
  onSubmit: (d: any) => void;
  onDone: () => void;
}) {
  try {
    const r1 = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(article),
    });
    if (!r1.ok) {
      const e = await r1.json();
      throw new Error(e.error ?? "Error al crear artículo");
    }
    const created = await r1.json();
    onSubmit({ articleId: created.id, ...priceData });
    onDone();
  } catch (e: any) {
    toast({ title: "Error", description: e.message, variant: "destructive" });
  }
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
