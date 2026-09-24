"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
import {
  AttachmentUploader, AttachmentThumb,
} from "@/components/shared/attachment-uploader";
import { formatDateTime, formatDate, formatCurrency } from "@/lib/format";
import {
  Pencil, Loader2, Siren, Wrench, ClipboardList,
  Truck, Package, Building2, ChevronRight, Link2, CheckCircle2,
  ExternalLink, Image as ImageIcon, Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function IncidentDetailView() {
  const { params, setView } = useAppStore();
  const id = params.id;
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: inc, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: async () => {
      const r = await fetch(`/api/incidents/${id}`);
      if (!r.ok) throw new Error("Error al cargar incidencia");
      return r.json();
    },
    enabled: !!id,
  });

  const { data: attsData, refetch: refetchAtts } = useQuery({
    queryKey: ["incident", id, "attachments"],
    queryFn: async () => {
      const r = await fetch(`/api/incidents/${id}/attachments`);
      if (!r.ok) throw new Error("Error al cargar adjuntos");
      return r.json();
    },
    enabled: !!id,
  });
  const attachments = attsData?.items ?? [];

  const deleteAttMut = useMutation({
    mutationFn: async (attId: string) => {
      const r = await fetch(`/api/attachments/${attId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Error al borrar adjunto");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Adjunto eliminado" });
      refetchAtts();
      qc.invalidateQueries({ queryKey: ["incident", id] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/incidents/${id}`, {
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
      toast({ title: "Incidencia actualizada" });
      setShowEdit(false);
      qc.invalidateQueries({ queryKey: ["incident", id] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeMut = useMutation({
    mutationFn: async (resolution: string) => {
      const r = await fetch(`/api/incidents/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al cerrar incidencia");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Incidencia cerrada" });
      setShowClose(false);
      qc.invalidateQueries({ queryKey: ["incident", id] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/incidents/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al eliminar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Incidencia eliminada" });
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setView("incidents");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !inc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const isClosed = inc.status === "CLOSED";

  return (
    <div>
      <PageHeader
        title={inc.number}
        description={inc.client?.name ?? "—"}
        backTo="incidents"
        actions={
          <>
            <Button variant="outline" onClick={() => setShowEdit(true)}>
              <Pencil className="w-4 h-4 mr-2" /> Editar
            </Button>
            {!isClosed && (
              <Button variant="outline" onClick={() => setShowClose(true)}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Cerrar incidencia
              </Button>
            )}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar incidencia</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Eliminar la incidencia <strong>{inc.number}</strong>? Esta acción no se puede deshacer.
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
            <AttachmentUploader
              entityType="INCIDENT"
              entityId={id}
              variant="compact"
              onUploaded={() => {
                refetchAtts();
                qc.invalidateQueries({ queryKey: ["incident", id] });
              }}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Columna izquierda: datos + trazabilidad */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Siren className="w-4 h-4" /> Detalle de la incidencia
                </CardTitle>
                <StatusBadge kind="incident" value={inc.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Apertura</Label>
                  <div>{formatDateTime(inc.openedAt)}</div>
                  <div className="text-xs text-muted-foreground">por {inc.createdBy?.name ?? "—"}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cierre</Label>
                  <div>{inc.closedAt ? formatDateTime(inc.closedAt) : "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {inc.closedBy?.name ? `por ${inc.closedBy.name}` : "pendiente"}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Descripción</Label>
                <p className="text-sm whitespace-pre-wrap border-l-2 border-primary/40 pl-3 mt-1">
                  {inc.description}
                </p>
              </div>

              {(inc.resolution || isClosed) && (
                <div>
                  <Label className="text-xs text-muted-foreground">Resolución</Label>
                  <p className="text-sm whitespace-pre-wrap border-l-2 border-green-500/40 pl-3 mt-1">
                    {inc.resolution || "—"}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-border space-y-2 text-sm">
                {/* Cliente */}
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cliente:</span>
                  <button
                    onClick={() => setView("client-detail", { id: inc.client.id })}
                    className="font-medium text-primary hover:underline truncate"
                  >
                    {inc.client.name}
                  </button>
                </div>

                {/* Instalación */}
                {inc.installation && (
                  <div className="flex items-start gap-2">
                    <Wrench className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground mt-0.5">Equipo:</span>
                    <button
                      onClick={() => setView("installation-detail", { id: inc.installation.id })}
                      className="text-left"
                    >
                      <div className="font-medium text-primary hover:underline">
                        {[inc.installation.brand, inc.installation.model].filter(Boolean).join(" ") || inc.installation.equipmentType}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {inc.installation.equipmentType}
                        {inc.installation.serialNumber ? ` · S/N ${inc.installation.serialNumber}` : ""}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bloque de trazabilidad COMPLETA */}
          <TraceabilityChain incident={inc} setView={setView} />
        </div>

        {/* Columna derecha: fotos adjuntas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Fotos adjuntas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AttachmentUploader
              entityType="INCIDENT"
              entityId={id}
              onUploaded={() => {
                refetchAtts();
                qc.invalidateQueries({ queryKey: ["incident", id] });
              }}
              label="Adjuntar foto"
            />
            {attachments.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">
                Sin fotos adjuntas. Añade fotos del problema, reparación, piezas
                sustituidas, etc.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {attachments.map((att: any) => (
                  <AttachmentThumb
                    key={att.id}
                    file={att}
                    onDelete={() => deleteAttMut.mutate(att.id)}
                  />
                ))}
              </div>
            )}
            {attachments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {attachments.length} adjunto(s). Última subida:{" "}
                {formatDateTime(attachments[0]?.createdAt)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      <EditDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        incident={inc}
        onSave={(payload) => updateMut.mutate(payload)}
        loading={updateMut.isPending}
      />

      {/* Close dialog */}
      <CloseDialog
        open={showClose}
        onOpenChange={setShowClose}
        onClose={(resolution) => closeMut.mutate(resolution)}
        loading={closeMut.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloque de trazabilidad COMPLETA
//   Renderiza el breadcrumb vertical con chips clickables para cada nivel:
//   Incidencia → Instalación → Pedido de venta → Presupuestos de compra →
//   Pedidos de compra → Albaranes de entrada → Proveedor
// ─────────────────────────────────────────────────────────────────────────────
function TraceabilityChain({
  incident,
  setView,
}: {
  incident: any;
  setView: (v: any, p?: Record<string, string>) => void;
}) {
  // El pedido de venta de origen: prioriza el directo de la incidencia, si no,
  // el de la instalación asociada.
  const directSaleOrder = incident.saleOrder ?? null;
  const installationSaleOrder = incident.installation?.sourceSaleOrder ?? null;
  const saleOrder = directSaleOrder || installationSaleOrder;

  const purchaseQuotes = saleOrder?.purchaseQuotes ?? [];
  const purchaseOrders = saleOrder?.purchaseOrders ?? [];

  // Proveedores únicos (de purchaseOrders + purchaseQuotes)
  const suppliersMap = new Map<string, { id: string; name: string }>();
  for (const po of purchaseOrders) {
    if (po.supplier) suppliersMap.set(po.supplier.id, po.supplier);
  }
  for (const pq of purchaseQuotes) {
    if (pq.supplier) suppliersMap.set(pq.supplier.id, pq.supplier);
  }
  const suppliers = Array.from(suppliersMap.values());

  // Albaranes de entrada de todos los pedidos de compra
  const allAlbaranes: any[] = [];
  for (const po of purchaseOrders) {
    for (const al of po.albaranes ?? []) {
      allAlbaranes.push({ ...al, purchaseOrder: { id: po.id, number: po.number } });
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="w-4 h-4" /> Trazabilidad completa
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cadena que conecta esta incidencia con el pedido de venta de origen y
          todas las compras que motivaron el equipo.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {/* Paso 1: Incidencia (entidad actual) */}
          <TraceStep
            icon={<Siren className="w-4 h-4" />}
            label="Incidencia"
            chips={[{ label: incident.number, active: true }]}
          />

          {/* Paso 2: Instalación */}
          <TraceStep
            icon={<Wrench className="w-4 h-4" />}
            label="Instalación"
            chips={
              incident.installation
                ? [{
                    label:
                      [incident.installation.brand, incident.installation.model].filter(Boolean).join(" ") ||
                      incident.installation.equipmentType,
                    onClick: () => setView("installation-detail", { id: incident.installation.id }),
                  }]
                : null
            }
          />

          {/* Paso 3: Pedido de venta de origen */}
          <TraceStep
            icon={<ClipboardList className="w-4 h-4" />}
            label="Pedido de venta"
            chips={
              saleOrder
                ? [{
                    label: saleOrder.number,
                    onClick: () => setView("sale-order-detail", { id: saleOrder.id }),
                  }]
                : null
            }
            hint={
              incident.saleOrder && incident.installation?.sourceSaleOrder
                ? "Vinculado directamente a la incidencia"
                : incident.installation?.sourceSaleOrder
                  ? "Heredado de la instalación"
                  : "Sin pedido de venta asociado"
            }
          />

          {/* Paso 4: Presupuestos de compra */}
          <TraceStep
            icon={<ClipboardList className="w-4 h-4" />}
            label="Presupuestos de compra"
            chips={purchaseQuotes.map((pq: any) => ({
              label: `PV-${pq.issueDate ? new Date(pq.issueDate).getFullYear() : ""} · ${pq.supplier?.name ?? "—"}`,
              sublabel: formatCurrency(pq.total),
              onClick: () => setView("purchase-quote-detail", { id: pq.id }),
            }))}
            hint={
              purchaseQuotes.length === 0 ? "Sin presupuestos de compra vinculados" : undefined
            }
          />

          {/* Paso 5: Pedidos de compra */}
          <TraceStep
            icon={<Package className="w-4 h-4" />}
            label="Pedidos de compra"
            chips={purchaseOrders.map((po: any) => ({
              label: po.number,
              sublabel: po.supplier?.name,
              onClick: () => setView("purchase-order-detail", { id: po.id }),
            }))}
            hint={
              purchaseOrders.length === 0 ? "Sin pedidos de compra vinculados" : undefined
            }
          />

          {/* Paso 6: Albaranes de entrada */}
          <TraceStep
            icon={<Truck className="w-4 h-4" />}
            label="Albaranes de entrada"
            chips={allAlbaranes.map((al: any) => ({
              label: formatDate(al.date),
              sublabel: al.purchaseOrder?.number,
              onClick: () => setView("purchase-order-detail", { id: al.purchaseOrder.id }),
            }))}
            hint={
              allAlbaranes.length === 0 ? "Sin albaranes de entrada registrados" : undefined
            }
          />

          {/* Paso 7: Proveedores */}
          <TraceStep
            icon={<Building2 className="w-4 h-4" />}
            label="Proveedores"
            chips={suppliers.map((s) => ({
              label: s.name,
              onClick: () => setView("supplier-detail", { id: s.id }),
            }))}
            hint={suppliers.length === 0 ? "Sin proveedores en la cadena" : undefined}
          />
        </ol>
      </CardContent>
    </Card>
  );
}

function TraceStep({
  icon,
  label,
  chips,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  chips:
    | { label: string; sublabel?: string; active?: boolean; onClick?: () => void }[]
    | null;
  hint?: string;
}) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-start gap-2">
      <div className="flex items-center gap-2 sm:w-52 shrink-0">
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex-1 flex flex-wrap gap-2 items-center min-w-0">
        {chips && chips.length > 0 ? (
          chips.map((c, i) => (
            <span key={i} className="flex items-center">
              {c.onClick && !c.active ? (
                <button
                  onClick={c.onClick}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-background px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <span className="truncate">{c.label}</span>
                      {c.sublabel && (
                        <span className="text-muted-foreground font-normal">
                          · {c.sublabel}
                        </span>
                      )}
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
                  {c.label}
                  {c.sublabel && (
                    <span className="text-primary/70 font-normal">· {c.sublabel}</span>
                  )}
                </span>
              )}
              {i < (chips?.length ?? 0) - 1 && (
                <ChevronRight className="w-3 h-3 mx-1 text-muted-foreground/50" />
              )}
            </span>
          ))
        ) : (
          <span className="text-sm text-muted-foreground italic">—</span>
        )}
      </div>
      {hint && (
        <span className="text-xs text-muted-foreground/80 italic sm:ml-auto sm:text-right">
          {hint}
        </span>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit dialog: description + resolution
// ─────────────────────────────────────────────────────────────────────────────
function EditDialog({
  open,
  onOpenChange,
  incident,
  onSave,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incident: any;
  onSave: (payload: any) => void;
  loading: boolean;
}) {
  const [description, setDescription] = useState(incident?.description ?? "");
  const [resolution, setResolution] = useState(incident?.resolution ?? "");

  // Reset al abrir
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setDescription(incident?.description ?? "");
      setResolution(incident?.resolution ?? "");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Editar incidencia {incident?.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Descripción *</Label>
            <Textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Resolución</Label>
            <Textarea
              rows={4}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Vacío si aún no se ha resuelto."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Para cerrar la incidencia con fecha/hora y responsable, usa el
              botón «Cerrar incidencia».
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onSave({ description, resolution: resolution || null })}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Close dialog: resolution textarea → POST /close
// ─────────────────────────────────────────────────────────────────────────────
function CloseDialog({
  open,
  onOpenChange,
  onClose,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onClose: (resolution: string) => void;
  loading: boolean;
}) {
  const [resolution, setResolution] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (v) setResolution("");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Cerrar incidencia
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Resolución *</Label>
          <Textarea
            rows={5}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="ej. Sustituido condensador. Verificado funcionamiento correcto. Garantía de la reparación: 6 meses."
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Al cerrar se registrarán la fecha/hora de cierre y el usuario
            responsable. La incidencia pasará a estado «Cerrada».
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!resolution.trim()) {
                toast({ title: "La resolución es obligatoria", variant: "destructive" });
                return;
              }
              onClose(resolution.trim());
            }}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Cerrar incidencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
