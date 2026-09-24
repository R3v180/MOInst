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
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate, fullAddress } from "@/lib/format";
import {
  Save, Loader2, Trash2, Plus, Wrench, FileText, Send, Check, FileInput,
  Mail, Printer, Clipboard, Pencil, X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type Line = {
  id?: string;
  articleId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  isLabor: boolean;
  sortOrder: number;
};

type Article = {
  id: string;
  name: string;
  internalCode: string;
  category: string;
  brand?: string | null;
  unit?: string;
  supplierPrices?: { price: number }[];
};

const DEFAULT_EMAIL_TEMPLATE = `Estimado/a {clienteName},

Adjunto el presupuesto solicitado (nº {quoteNumber}) con un total de {total}.

El presupuesto tiene una validez de 30 días. Si tiene cualquier duda o desea modificar algún punto, no dude en contactarnos.

Quedamos a su disposición.
Saludos cordiales,
{companyName}`;

function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export function SaleQuoteDetailView() {
  const { params, setView } = useAppStore();
  const id = params.id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: quote, isLoading } = useQuery({
    queryKey: ["sale-quote", id],
    queryFn: () => fetch(`/api/sale-quotes/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "", "", false],
    queryFn: () => fetch(`/api/clients?pageSize=100`).then((r) => r.json()),
  });
  const clients = clientsData?.items ?? [];

  // Mutaciones
  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/sale-quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al guardar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Presupuesto guardado" });
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["sale-quote", id] });
      qc.invalidateQueries({ queryKey: ["sale-quotes"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMut = useMutation({
    mutationFn: async (status: string) => {
      const r = await fetch(`/api/sale-quotes/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al cambiar estado");
      }
      return r.json();
    },
    onSuccess: (_d, status) => {
      toast({
        title: "Estado actualizado",
        description: status === "SENT" ? "Marcado como enviado" : status === "ACCEPTED" ? "Marcado como aceptado" : status,
      });
      qc.invalidateQueries({ queryKey: ["sale-quote", id] });
      qc.invalidateQueries({ queryKey: ["sale-quotes"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateOrderMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sale-quotes/${id}/generate-order`, { method: "POST" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al generar pedido");
      }
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "Pedido generado", description: data.number });
      qc.invalidateQueries({ queryKey: ["sale-quote", id] });
      qc.invalidateQueries({ queryKey: ["sale-quotes"] });
      qc.invalidateQueries({ queryKey: ["sale-orders"] });
      setView("sale-order-detail", { id: data.id });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sale-quotes/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al eliminar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Presupuesto eliminado" });
      qc.invalidateQueries({ queryKey: ["sale-quotes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setView("sale-quotes");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (quote && !draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft({
        clientId: quote.clientId,
        installationId: quote.installationId ?? null,
        issueDate: quote.issueDate ? new Date(quote.issueDate).toISOString().slice(0, 10) : "",
        validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString().slice(0, 10) : "",
        notes: quote.notes ?? "",
        lines: (quote.lines ?? []).map((l: any, idx: number) => ({
          id: l.id,
          articleId: l.articleId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          isLabor: l.isLabor,
          sortOrder: l.sortOrder ?? idx,
        })),
      });
    }
  }, [quote, draft]);

  if (isLoading || !quote) {
    return <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-96" /></div>;
  }

  const status = quote.status;

  // Cálculo de totales (en tiempo real cuando se edita, o desde el quote cuando no)
  const list = editing && draft
    ? draft.lines.map((l: Line, idx: number) => ({
        ...l,
        subtotal: round2((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discount) || 0) / 100)),
        sortOrder: l.sortOrder ?? idx,
      }))
    : (quote.lines ?? []).map((l: any) => ({ ...l, subtotal: l.subtotal }));
  const laborTotal = round2(list.filter((l: any) => l.isLabor).reduce((s: number, l: any) => s + l.subtotal, 0));
  const materials = round2(list.filter((l: any) => !l.isLabor).reduce((s: number, l: any) => s + l.subtotal, 0));
  const total = round2(list.reduce((s: number, l: any) => s + l.subtotal, 0));
  const computed = { list, laborTotal, materials, total };

  const client = quote.client;

  const startEdit = () => {
    setDraft({
      clientId: quote.clientId,
      installationId: quote.installationId ?? null,
      issueDate: quote.issueDate ? new Date(quote.issueDate).toISOString().slice(0, 10) : "",
      validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString().slice(0, 10) : "",
      notes: quote.notes ?? "",
      lines: (quote.lines ?? []).map((l: any, idx: number) => ({
        id: l.id,
        articleId: l.articleId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        isLabor: l.isLabor,
        sortOrder: l.sortOrder ?? idx,
      })),
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const save = () => {
    if (!draft) return;
    updateMut.mutate({
      clientId: draft.clientId,
      installationId: draft.installationId,
      issueDate: draft.issueDate || undefined,
      validUntil: draft.validUntil || null,
      notes: draft.notes || null,
      lines: draft.lines.map((l: Line, idx: number) => ({
        articleId: l.articleId,
        description: l.description,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discount: Number(l.discount) || 0,
        isLabor: !!l.isLabor,
        sortOrder: idx,
      })),
    });
  };

  // Mutadores de líneas en draft
  const updateLine = (idx: number, patch: Partial<Line>) => {
    setDraft((d: any) => ({
      ...d,
      lines: d.lines.map((l: Line, i: number) => (i === idx ? { ...l, ...patch } : l)),
    }));
  };
  const removeLine = (idx: number) => {
    setDraft((d: any) => ({ ...d, lines: d.lines.filter((_: any, i: number) => i !== idx) }));
  };
  const addLine = (isLabor: boolean) => {
    setDraft((d: any) => ({
      ...d,
      lines: [
        ...d.lines,
        {
          articleId: null,
          description: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          isLabor,
          sortOrder: d.lines.length,
        },
      ],
    }));
  };
  const setLineFromArticle = (idx: number, art: Article) => {
    const latestPrice = art.supplierPrices && art.supplierPrices.length > 0 ? art.supplierPrices[0].price : 0;
    setDraft((d: any) => ({
      ...d,
      lines: d.lines.map((l: Line, i: number) =>
        i === idx
          ? {
              ...l,
              articleId: art.id,
              description: art.name + (art.brand ? ` · ${art.brand}` : ""),
              unitPrice: latestPrice,
            }
          : l
      ),
    }));
  };

  // Variables para plantilla email
  const emailVars: Record<string, string> = {
    clienteName: client?.name ?? "",
    quoteNumber: quote.number,
    total: formatCurrency(computed.total),
    companyName: quote.settings?.companyName ?? "MOInst",
  };
  const emailTemplate = (quote.settings?.emailTemplateQuote as string) ?? DEFAULT_EMAIL_TEMPLATE;
  const emailBody = fillTemplate(emailTemplate, emailVars);

  return (
    <div>
      <PageHeader
        title={quote.number}
        description={`Cliente: ${client?.name ?? "—"} · Emitido ${formatDate(quote.issueDate)}`}
        backTo="sale-quotes"
        actions={
          <>
            {editing ? (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={updateMut.isPending}>
                  <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
                <Button onClick={save} disabled={updateMut.isPending}>
                  {updateMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar cambios
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startEdit}>
                  <Pencil className="w-4 h-4 mr-2" /> Editar
                </Button>
                {status === "DRAFT" && (
                  <Button variant="outline" onClick={() => statusMut.mutate("SENT")} disabled={statusMut.isPending}>
                    {statusMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Marcar enviado
                  </Button>
                )}
                {status === "SENT" && (
                  <Button variant="outline" onClick={() => statusMut.mutate("ACCEPTED")} disabled={statusMut.isPending}>
                    {statusMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Marcar aceptado
                  </Button>
                )}
                {status === "ACCEPTED" && (
                  <Button onClick={() => generateOrderMut.mutate()} disabled={generateOrderMut.isPending}>
                    {generateOrderMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileInput className="w-4 h-4 mr-2" />}
                    Generar pedido
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowPreview(true)}>
                  <Printer className="w-4 h-4 mr-2" /> Vista previa PDF
                </Button>
                <Button variant="outline" onClick={() => setShowEmail(true)}>
                  <Mail className="w-4 h-4 mr-2" /> Enviar por email
                </Button>
                {status === "DRAFT" && (
                  <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar presupuesto</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Eliminar el presupuesto <strong>{quote.number}</strong>? Esta acción no se puede deshacer.
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
                )}
              </>
            )}
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
              onClick={() => setView("client-detail", { id: quote.clientId }, quote.client?.name || "Cliente")}
            >
              {client?.name ?? "—"}
            </button>
            <div className="text-xs text-muted-foreground mt-0.5">{fullAddress(client)}</div>
            {client?.phonePrimary && <div className="text-xs text-muted-foreground">{client.phonePrimary}</div>}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Instalación vinculada</div>
            {quote.installation ? (
              <button
                className="text-sm font-medium text-primary hover:underline text-left flex items-center gap-1"
                onClick={() => setView("installation-detail", { id: quote.installation.id }, [quote.installation.brand, quote.installation.model].filter(Boolean).join(" ") || quote.installation.equipmentType)}
              >
                <Wrench className="w-3.5 h-3.5" />
                {[quote.installation.brand, quote.installation.model].filter(Boolean).join(" ") || quote.installation.equipmentType}
              </button>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Emisión / Validez</div>
            <div className="text-sm font-medium">{formatDate(quote.issueDate)}</div>
            <div className="text-xs text-muted-foreground">Válido hasta: {formatDate(quote.validUntil)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Estado / Total</div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge kind="saleQuote" value={status} />
            </div>
            <div className="text-lg font-bold mt-1">{formatCurrency(computed.total)}</div>
            {quote.createdBy?.name && (
              <div className="text-xs text-muted-foreground">Creado por {quote.createdBy.name}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Líneas */}
      <Card className="mb-4">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Líneas
          </CardTitle>
          {editing && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addLine(false)}>
                <Plus className="w-4 h-4 mr-1" /> Artículo
              </Button>
              <Button size="sm" variant="outline" onClick={() => addLine(true)}>
                <Plus className="w-4 h-4 mr-1" /> Mano de obra
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {computed.list.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {editing ? "Añade líneas con los botones superiores." : "Sin líneas. Edita el presupuesto para añadir líneas."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Descripción</TableHead>
                    <TableHead className="w-20">Cant.</TableHead>
                    <TableHead className="w-28">P. unit.</TableHead>
                    <TableHead className="w-24">Desc. %</TableHead>
                    <TableHead className="w-32 text-right">Subtotal</TableHead>
                    {editing && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computed.list.map((l: any, idx: number) => (
                    <TableRow key={l.id ?? idx} className={l.isLabor ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}>
                      <TableCell>
                        {editing ? (
                          <LineDescriptionInput
                            value={l.description}
                            isLabor={l.isLabor}
                            onChange={(v) => updateLine(idx, { description: v })}
                            onArticle={(art) => setLineFromArticle(idx, art)}
                          />
                        ) : (
                          <div>
                            <div className="text-sm font-medium">{l.description}</div>
                            {l.isLabor && <Badge variant="outline" className="mt-0.5 text-amber-700 border-amber-300">Mano de obra</Badge>}
                            {l.article && <div className="text-xs text-muted-foreground">{l.article.internalCode} · {l.article.name}</div>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={l.quantity}
                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                            className="w-20"
                          />
                        ) : (
                          <span className="text-sm">{l.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={l.unitPrice}
                            onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
                            className="w-28"
                          />
                        ) : (
                          <span className="text-sm">{formatCurrency(l.unitPrice)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={l.discount}
                            onChange={(e) => updateLine(idx, { discount: Number(e.target.value) })}
                            className="w-24"
                          />
                        ) : (
                          <span className="text-sm">{l.discount}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(l.subtotal)}</TableCell>
                      {editing && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} title="Eliminar línea">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totales */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Condiciones / Notas</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <Textarea
                value={draft?.notes ?? ""}
                onChange={(e) => setDraft((d: any) => ({ ...d, notes: e.target.value }))}
                rows={4}
                placeholder="Condiciones de pago, plazos de entrega, garantía..."
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap min-h-[80px]">{quote.notes || "—"}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Totales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Materiales</span>
              <span className="font-medium">{formatCurrency(computed.materials)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Mano de obra</span>
              <span className="font-medium">{formatCurrency(computed.laborTotal)}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">{formatCurrency(computed.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pedidos generados */}
      {quote.saleOrders && quote.saleOrders.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pedidos generados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {quote.saleOrders.map((o: any) => (
                <li key={o.id}>
                  <button
                    onClick={() => setView("sale-order-detail", { id: o.id }, o.number)}
                    className="w-full text-left py-3 px-4 hover:bg-accent flex items-center gap-3"
                  >
                    <FileInput className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{o.number}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(o.issueDate)}</div>
                    </div>
                    <StatusBadge kind="saleOrder" value={o.status} />
                    <StatusBadge kind="payment" value={o.paymentStatus} />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Vista previa del documento */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scroll-thin">
          <DialogHeader>
            <DialogTitle>Vista previa — {quote.number}</DialogTitle>
          </DialogHeader>
          <div id="print-area" className="bg-white text-black p-6 rounded-md border border-border">
            <PrintableQuote quote={quote} computed={computed} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Cerrar</Button>
            <Button onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
            </Button>
          </DialogFooter>
          <style dangerouslySetInnerHTML={{ __html: `@media print { body * { visibility: hidden !important; } #print-area, #print-area * { visibility: visible !important; } #print-area { position: absolute; top: 0; left: 0; width: 100%; border: none !important; } }` }} />
        </DialogContent>
      </Dialog>

      {/* Email dialog */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Enviar por email — {quote.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Destinatario</Label>
              <Input value={client?.email ?? ""} readOnly placeholder="El cliente no tiene email" />
            </div>
            <div>
              <Label>Mensaje</Label>
              <Textarea value={emailBody} readOnly rows={10} className="font-mono text-xs" />
            </div>
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              No se envía automáticamente: copia el texto y pégalo en tu cliente de correo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmail(false)}>Cerrar</Button>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(emailBody);
                  toast({ title: "Texto copiado", description: "Pégalo en tu cliente de correo." });
                } catch {
                  toast({ title: "No se pudo copiar", description: "Copia el texto manualmente.", variant: "destructive" });
                }
              }}
            >
              <Clipboard className="w-4 h-4 mr-2" /> Copiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LineDescriptionInput({
  value,
  isLabor,
  onChange,
  onArticle,
}: {
  value: string;
  isLabor: boolean;
  onChange: (v: string) => void;
  onArticle: (art: Article) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey: ["articles-autocomplete", search],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search) p.set("q", search);
      p.set("pageSize", "20");
      const r = await fetch(`/api/articles?${p.toString()}`);
      if (!r.ok) return { items: [] };
      return r.json();
    },
    enabled: open && search.length > 0,
  });
  const results: Article[] = data?.items ?? [];

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (!isLabor) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={isLabor ? "Descripción de la mano de obra" : "Descripción o busca artículo..."}
        className={isLabor ? "border-amber-300 bg-amber-50/40 dark:bg-amber-900/10" : ""}
      />
      {open && !isLabor && search.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-80 max-h-72 overflow-y-auto scroll-thin rounded-md border border-border bg-popover shadow-md">
          {results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              Sin coincidencias. Sigue escribiendo para usarlo como texto libre.
            </div>
          ) : (
            <ul className="py-1">
              {results.map((a: Article) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onArticle(a);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.internalCode} · {a.category}</div>
                    </div>
                    {a.supplierPrices && a.supplierPrices[0] && (
                      <span className="text-xs text-muted-foreground shrink-0">{formatCurrency(a.supplierPrices[0].price)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PrintableQuote({ quote, computed }: { quote: any; computed: any }) {
  const client = quote.client;
  const company = quote.settings?.companyName ?? "MOInst";
  return (
    <div className="text-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xl font-bold">{company}</div>
          <div className="text-xs text-gray-600">Instalación de climatización, calderas y termos</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">PRESUPUESTO</div>
          <div className="text-xs text-gray-600">{quote.number}</div>
          <div className="text-xs text-gray-600">{formatDate(quote.issueDate)}</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="border border-gray-300 rounded p-3">
          <div className="text-xs text-gray-500 uppercase mb-1">Cliente</div>
          <div className="font-semibold">{client?.name}</div>
          {client?.nif && <div className="text-xs">NIF: {client.nif}</div>}
          <div className="text-xs">{fullAddress(client)}</div>
          {client?.phonePrimary && <div className="text-xs">Tlf: {client.phonePrimary}</div>}
          {client?.email && <div className="text-xs">{client.email}</div>}
        </div>
        <div className="border border-gray-300 rounded p-3">
          <div className="text-xs text-gray-500 uppercase mb-1">Datos del presupuesto</div>
          <div className="text-xs">Fecha: {formatDate(quote.issueDate)}</div>
          <div className="text-xs">Válido hasta: {formatDate(quote.validUntil)}</div>
          <div className="text-xs mt-1">
            Estado: <span className="font-semibold">{quote.status}</span>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-2 py-1 text-left text-xs">Descripción</th>
            <th className="border border-gray-300 px-2 py-1 text-right text-xs w-16">Cant.</th>
            <th className="border border-gray-300 px-2 py-1 text-right text-xs w-24">P. unit.</th>
            <th className="border border-gray-300 px-2 py-1 text-right text-xs w-20">Desc.</th>
            <th className="border border-gray-300 px-2 py-1 text-right text-xs w-28">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {computed.list.map((l: any, idx: number) => (
            <tr key={idx}>
              <td className="border border-gray-300 px-2 py-1 text-xs">
                {l.description}
                {l.isLabor && <span className="text-gray-500"> (mano de obra)</span>}
              </td>
              <td className="border border-gray-300 px-2 py-1 text-right text-xs">{l.quantity}</td>
              <td className="border border-gray-300 px-2 py-1 text-right text-xs">{formatCurrency(l.unitPrice)}</td>
              <td className="border border-gray-300 px-2 py-1 text-right text-xs">{l.discount}%</td>
              <td className="border border-gray-300 px-2 py-1 text-right text-xs font-semibold">{formatCurrency(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-6">
        <div className="w-64 space-y-1">
          <div className="flex justify-between text-xs">
            <span>Materiales:</span>
            <span>{formatCurrency(computed.materials)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Mano de obra:</span>
            <span>{formatCurrency(computed.laborTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-300 pt-1 font-bold text-sm">
            <span>TOTAL:</span>
            <span>{formatCurrency(computed.total)}</span>
          </div>
        </div>
      </div>

      {quote.notes && (
        <div className="mb-6">
          <div className="text-xs text-gray-500 uppercase mb-1">Condiciones</div>
          <div className="text-xs whitespace-pre-wrap border border-gray-200 rounded p-2">{quote.notes}</div>
        </div>
      )}

      <div className="text-xs text-gray-500 border-t border-gray-300 pt-2">
        Presupuesto válido hasta {formatDate(quote.validUntil)}. Precios con IVA incluido.
        <br />
        Para aceptar el presupuesto, responda a este correo o llámenos.
      </div>
    </div>
  );
}
