"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/format";
import {
  Package,
  Plus,
  Search,
  Tag,
  Factory,
  Boxes,
  TriangleAlert,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

const TYPE_LABELS: Record<string, string> = {
  SERIALIZED: "Serializado",
  CONSUMABLE: "Consumible",
};

export function ArticlesView() {
  const { setView } = useAppStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [articleType, setArticleType] = useState("all");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["articles", q, category, articleType, onlyLowStock],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (category !== "all") p.set("category", category);
      if (articleType !== "all") p.set("articleType", articleType);
      if (onlyLowStock) p.set("lowStock", "1");
      const r = await fetch(`/api/articles?${p.toString()}`);
      return r.json();
    },
    placeholderData: (prev: any) => prev,
  });

  // Cargar categorías una vez
  useQuery({
    queryKey: ["articles-categories"],
    queryFn: async () => {
      const r = await fetch(`/api/articles?page=1&pageSize=1`);
      const j = await r.json();
      setCategories(j.categories ?? []);
      return j.categories;
    },
  });

  const items = data?.items ?? [];

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/articles", {
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
    onSuccess: (article) => {
      toast({ title: "Artículo creado" });
      qc.invalidateQueries({ queryKey: ["articles"] });
      setShowNew(false);
      setView("article-detail", { id: article.id });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Artículos"
        description={`${data?.total ?? 0} artículos en catálogo`}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo artículo
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, código interno o marca..."
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c: string) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={articleType} onValueChange={setArticleType}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="SERIALIZED">Serializado</SelectItem>
            <SelectItem value="CONSUMABLE">Consumible</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-background">
          <Switch id="lowStock" checked={onlyLowStock} onCheckedChange={setOnlyLowStock} />
          <Label htmlFor="lowStock" className="text-sm cursor-pointer whitespace-nowrap">
            Stock bajo
          </Label>
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
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-3 w-1/3 mb-1" />
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
                  <Skeleton className="h-3 w-24" />
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title="Sin artículos"
          description="Crea tu primer artículo en el catálogo para empezar a usarlo en presupuestos y pedidos."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nuevo artículo
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a: any) => {
            const lowStock = a.stock <= a.stockMin;
            return (
              <button
                key={a.id}
                onClick={() => setView("article-detail", { id: a.id })}
                className="text-left"
              >
                <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{a.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{a.internalCode}</div>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_LABELS[a.articleType] ?? a.articleType}
                        </Badge>
                        {a.category && (
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                            <Tag className="w-3 h-3" /> {a.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {a.brand && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Factory className="w-3 h-3" /> {a.brand}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border text-xs">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 ${lowStock ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          <Boxes className="w-3.5 h-3.5" />
                          {a.stock} / {a.stockMin} {a.unit}
                        </span>
                        {lowStock && (
                          <span className="inline-flex items-center gap-0.5 text-destructive">
                            <TriangleAlert className="w-3 h-3" /> Bajo mín.
                          </span>
                        )}
                      </div>
                      {a.bestPrice ? (
                        <div className="text-right">
                          <div className="font-semibold text-sm">{formatCurrency(a.bestPrice.price)}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                            {a.bestPrice.supplierName}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Sin proveedor</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* Nuevo artículo */}
      <ArticleForm
        open={showNew}
        onOpenChange={setShowNew}
        categories={categories}
        onSubmit={(d) => createMut.mutate(d)}
        loading={createMut.isPending}
      />
    </div>
  );
}

function ArticleForm({
  open,
  onOpenChange,
  onSubmit,
  loading,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (d: any) => void;
  loading: boolean;
  categories: string[];
}) {
  const [d, setD] = useState<any>({});
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }));
  const isCatPreset = categories.includes(d.category ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Nuevo artículo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Código interno *</Label>
              <Input
                value={d.internalCode ?? ""}
                onChange={(e) => set("internalCode", e.target.value)}
                placeholder="ej. AC-SPLIT-12K"
              />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={d.articleType} onValueChange={(v) => set("articleType", v)}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SERIALIZED">Serializado (con nº serie)</SelectItem>
                  <SelectItem value="CONSUMABLE">Consumible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Nombre *</Label>
            <Input
              value={d.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ej. Split Daikin 12k BTU"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría *</Label>
              {categories.length > 0 ? (
                <Select value={isCatPreset ? d.category : "__custom"} onValueChange={(v) => {
                  if (v === "__custom") { set("category", ""); return; }
                  set("category", v);
                }}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    <SelectItem value="__custom">Otra (escribir)</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              <Input
                className="mt-1"
                value={d.category ?? ""}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Escribe o sobrescribe la categoría"
              />
            </div>
            <div>
              <Label>Marca</Label>
              <Input
                value={d.brand ?? ""}
                onChange={(e) => set("brand", e.target.value)}
                placeholder="ej. Daikin"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Unidad</Label>
              <Input
                value={d.unit ?? "unidad"}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="unidad, metro, kg..."
              />
            </div>
            <div>
              <Label>Stock</Label>
              <Input
                type="number"
                step="0.01"
                value={d.stock ?? 0}
                onChange={(e) => set("stock", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Stock mínimo</Label>
              <Input
                type="number"
                step="0.01"
                value={d.stockMin ?? 0}
                onChange={(e) => set("stockMin", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              rows={2}
              value={d.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Notas técnicas, características..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSubmit(d)} disabled={loading || !d.name || !d.internalCode || !d.category || !d.articleType}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
