"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AttachmentUploader, AttachmentThumb,
} from "@/components/shared/attachment-uploader";
import { formatDate, daysUntil } from "@/lib/format";
import {
  Pencil, Save, Loader2, Plus, Wrench, MapPin, Calendar, ShieldCheck,
  ClipboardList, FileText, Siren, Trash2, Link2, ExternalLink,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activa" },
  { value: "REMOVED", label: "Retirada" },
  { value: "REPLACED", label: "Sustituida" },
];

export function InstallationDetailView() {
  const { params, setView } = useAppStore();
  const id = params.id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [showMaint, setShowMaint] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: inst, isLoading } = useQuery({
    queryKey: ["installation", id],
    queryFn: async () => {
      const r = await fetch(`/api/installations/${id}`);
      if (!r.ok) throw new Error("Error al cargar instalación");
      return r.json();
    },
    enabled: !!id,
  });

  const { data: attsData, refetch: refetchAtts } = useQuery({
    queryKey: ["installation", id, "attachments"],
    queryFn: async () => {
      const r = await fetch(`/api/installations/${id}/attachments`);
      if (!r.ok) throw new Error("Error al cargar adjuntos");
      return r.json();
    },
    enabled: !!id,
  });
  const attachments = attsData?.items ?? [];

  // Tipos de equipo (del listado meta) y meses por defecto
  const { data: listMeta } = useQuery({
    queryKey: ["installations", "", "all", "all", 1],
    queryFn: async () => {
      const r = await fetch(`/api/installations?pageSize=1`);
      if (!r.ok) return { meta: { installationTypes: [], defaultWarrantyMonths: 24 } };
      return r.json();
    },
    enabled: !!id,
  });
  const installationTypes: string[] =
    listMeta?.meta?.installationTypes ?? ["aire acondicionado", "caldera", "termo", "otro"];

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/installations/${id}`, {
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
      toast({ title: "Instalación actualizada" });
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["installation", id] });
      qc.invalidateQueries({ queryKey: ["installations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addMaintMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/installations/${id}/maintenances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al registrar mantenimiento");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Mantenimiento registrado" });
      setShowMaint(false);
      qc.invalidateQueries({ queryKey: ["installation", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMaintMut = useMutation({
    mutationFn: async (mid: string) => {
      const r = await fetch(`/api/installations/${id}/maintenances/${mid}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Error al borrar mantenimiento");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Mantenimiento eliminado" });
      qc.invalidateQueries({ queryKey: ["installation", id] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/installations/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al eliminar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Instalación eliminada" });
      qc.invalidateQueries({ queryKey: ["installations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setView("installations");
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !inst) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const warrantyDays = daysUntil(inst.warrantyEndDate);
  const warrantyExpired = warrantyDays !== null && warrantyDays < 0;
  const warrantySoon = warrantyDays !== null && warrantyDays >= 0 && warrantyDays < 30;
  const title = [inst.brand, inst.model].filter(Boolean).join(" ") || inst.equipmentType;

  const openEdit = () => {
    setDraft({
      equipmentType: inst.equipmentType ?? "",
      brand: inst.brand ?? "",
      model: inst.model ?? "",
      serialNumber: inst.serialNumber ?? "",
      location: inst.location ?? "",
      installDate: inst.installDate ? new Date(inst.installDate).toISOString().slice(0, 10) : "",
      warrantyEndDate: inst.warrantyEndDate ? new Date(inst.warrantyEndDate).toISOString().slice(0, 10) : "",
      status: inst.status ?? "ACTIVE",
      notes: inst.notes ?? "",
    });
    setEditing(true);
  };

  return (
    <div>
      <PageHeader
        title={title}
        description={`${inst.equipmentType}${inst.client ? ` · ${inst.client.name}` : ""}`}
        backTo="installations"
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
                  <AlertDialogTitle>Eliminar instalación</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Seguro que quieres eliminar esta instalación? Esta acción no se puede deshacer. Se eliminarán también sus mantenimientos, incidencias y adjuntos asociados.
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
            <Button variant="outline" onClick={() => setView("incidents")}>
              <Siren className="w-4 h-4 mr-2" /> Nueva incidencia
            </Button>
            <Button onClick={() => setShowMaint(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nuevo mantenimiento
            </Button>
          </>
        }
      />

      {/* Trazabilidad */}
      {inst.sourceSaleOrder && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-primary">
              <Link2 className="w-5 h-5" />
              <span className="text-sm font-semibold">Trazabilidad</span>
            </div>
            <div className="flex-1 min-w-0 text-sm">
              Equipo instalado desde el pedido de venta{" "}
              <button
                onClick={() => setView("sale-order-detail", { id: inst.sourceSaleOrder.id }, inst.sourceSaleOrder.number)}
                className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                {inst.sourceSaleOrder.number}
                <ExternalLink className="w-3 h-3" />
              </button>
              {inst.sourceSaleOrder.client && (
                <span className="text-muted-foreground"> · {inst.sourceSaleOrder.client.name}</span>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">
                Desde el pedido puedes ver presupuestos de compra y pedidos a proveedores asociados.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView("sale-order-detail", { id: inst.sourceSaleOrder.id }, inst.sourceSaleOrder.number)}
            >
              Ver pedido
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Columna izquierda: datos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              Datos del equipo
            </CardTitle>
            <CardDescription>Información técnica y de instalación</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Cliente" icon={<span />} className="sm:col-span-2">
              {inst.client ? (
                <button
                  onClick={() => setView("client-detail", { id: inst.client.id }, inst.client.name)}
                  className="text-primary hover:underline font-medium"
                >
                  {inst.client.name}
                </button>
              ) : "—"}
            </Info>
            <Info label="Tipo de equipo">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Wrench className="w-3 h-3" /> {inst.equipmentType}
              </span>
            </Info>
            <Info label="Estado"><StatusBadge kind="installation" value={inst.status} /></Info>
            <Info label="Marca">{inst.brand || "—"}</Info>
            <Info label="Modelo">{inst.model || "—"}</Info>
            <Info label="Nº de serie">
              <span className="font-mono text-sm">{inst.serialNumber || "—"}</span>
            </Info>
            <Info label="Ubicación" icon={<MapPin className="w-3.5 h-3.5" />}>
              {inst.location || "—"}
            </Info>
            <Info label="Fecha de instalación" icon={<Calendar className="w-3.5 h-3.5" />}>
              {formatDate(inst.installDate)}
            </Info>
            <Info label="Fin de garantía" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
              {inst.warrantyEndDate ? (
                <span className={
                  warrantyExpired
                    ? "text-destructive font-medium"
                    : warrantySoon
                      ? "text-amber-600 dark:text-amber-400 font-medium"
                      : ""
                }>
                  {formatDate(inst.warrantyEndDate)}
                  {warrantyExpired
                    ? " · caducada"
                    : warrantySoon
                      ? ` · en ${warrantyDays}d`
                      : ` · en ${warrantyDays}d`}
                </span>
              ) : "—"}
            </Info>
            <Info label="Pedido de venta origen" className="sm:col-span-2">
              {inst.sourceSaleOrder ? (
                <button
                  onClick={() => setView("sale-order-detail", { id: inst.sourceSaleOrder.id }, inst.sourceSaleOrder.number)}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  {inst.sourceSaleOrder.number}
                </button>
              ) : <span className="text-muted-foreground">Sin pedido asociado</span>}
            </Info>
            <Info label="Notas internas" className="sm:col-span-2">
              <span className="text-sm whitespace-pre-wrap">{inst.notes || "—"}</span>
            </Info>
            <div className="sm:col-span-2 pt-3 border-t border-border text-xs text-muted-foreground">
              Creada por {inst.createdBy?.name ?? "—"} el {formatDate(inst.createdAt)}
            </div>
          </CardContent>
        </Card>

        {/* Columna derecha: galería de fotos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Fotos y documentos
            </CardTitle>
            <CardDescription>Adjuntos del equipo (fotos, etiquetas, partes)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AttachmentUploader
              entityType="INSTALLATION"
              entityId={id}
              accept="image/*,application/pdf"
              onUploaded={() => refetchAtts()}
            />
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sin adjuntos. Sube fotos de la instalación, etiqueta de serie, partes de trabajo...
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {attachments.map((a: any) => (
                  <AttachmentThumb
                    key={a.id}
                    file={a}
                    onDelete={async () => {
                      try {
                        const r = await fetch(`/api/attachments/${a.id}`, { method: "DELETE" });
                        if (!r.ok) throw new Error();
                        toast({ title: "Adjunto eliminado" });
                        refetchAtts();
                      } catch {
                        toast({ title: "Error al borrar", variant: "destructive" });
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        {/* Historial de mantenimientos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Historial de mantenimientos
              </span>
              <Button size="sm" variant="outline" onClick={() => setShowMaint(true)}>
                <Plus className="w-4 h-4 mr-1" /> Añadir
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!inst.maintenances || inst.maintenances.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sin mantenimientos registrados.
              </p>
            ) : (
              <ul className="divide-y divide-border max-h-96 overflow-y-auto scroll-thin">
                {inst.maintenances.map((m: any) => {
                  const next = daysUntil(m.nextReviewDate);
                  const nextSoon = next !== null && next >= 0 && next < 30;
                  const nextPast = next !== null && next < 0;
                  return (
                    <li key={m.id} className="p-4 flex gap-3">
                      <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">{formatDate(m.date)}</div>
                          <button
                            onClick={() => deleteMaintMut.mutate(m.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Eliminar mantenimiento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {m.nextReviewDate && (
                          <div className={
                            "text-xs " + (nextPast
                              ? "text-destructive"
                              : nextSoon
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground")
                          }>
                            Próxima revisión: {formatDate(m.nextReviewDate)}
                            {nextPast ? " · vencida" : nextSoon ? ` · en ${next}d` : ` · en ${next}d`}
                          </div>
                        )}
                        {m.notes && (
                          <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.notes}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Realizado por {m.performedBy?.name ?? "—"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Incidencias de esta instalación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Siren className="w-5 h-5 text-destructive" />
                Incidencias
              </span>
              <Button size="sm" variant="outline" onClick={() => setView("incidents")}>
                <Plus className="w-4 h-4 mr-1" /> Nueva
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!inst.incidents || inst.incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sin incidencias registradas para esta instalación.
              </p>
            ) : (
              <ul className="divide-y divide-border max-h-96 overflow-y-auto scroll-thin">
                {inst.incidents.map((i: any) => (
                  <li key={i.id}>
                    <button
                      onClick={() => setView("incident-detail", { id: i.id }, i.number)}
                      className="w-full text-left p-4 hover:bg-accent transition-colors flex items-center gap-3"
                    >
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
                        <Siren className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">{i.number}</div>
                          <StatusBadge kind="incident" value={i.status} />
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {formatDate(i.openedAt)} · {i.description?.slice(0, 80)}
                          {i.description && i.description.length > 80 ? "…" : ""}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Presupuestos asociados */}
      {inst.saleQuotes && inst.saleQuotes.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Presupuestos relacionados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {inst.saleQuotes.map((q: any) => (
                <li key={q.id}>
                  <button
                    onClick={() => setView("sale-quote-detail", { id: q.id }, q.number)}
                    className="w-full text-left p-4 hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{q.number}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(q.issueDate)}</div>
                    </div>
                    <StatusBadge kind="saleQuote" value={q.status} />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de edición */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto scroll-thin">
          <DialogHeader>
            <DialogTitle>Editar instalación</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de equipo</Label>
                  <Select
                    value={draft.equipmentType}
                    onValueChange={(v) => setDraft({ ...draft, equipmentType: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {installationTypes.map((t: string) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDraft({ ...draft, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Marca</Label><Input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} /></div>
                <div><Label>Modelo</Label><Input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nº de serie</Label><Input value={draft.serialNumber} onChange={(e) => setDraft({ ...draft, serialNumber: e.target.value })} /></div>
                <div><Label>Ubicación</Label><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fecha de instalación</Label>
                  <Input type="date" value={draft.installDate} onChange={(e) => setDraft({ ...draft, installDate: e.target.value })} />
                </div>
                <div>
                  <Label>Fin de garantía</Label>
                  <Input type="date" value={draft.warrantyEndDate} onChange={(e) => setDraft({ ...draft, warrantyEndDate: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Notas internas</Label>
                <Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button
              onClick={() => updateMut.mutate(draft)}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo nuevo mantenimiento */}
      <MaintenanceForm
        key={`maint-${showMaint}`}
        open={showMaint}
        onOpenChange={setShowMaint}
        onSubmit={(d) => addMaintMut.mutate(d)}
        loading={addMaintMut.isPending}
        defaultDate={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────
function Info({
  label, children, icon, className,
}: {
  label: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}{label}
      </div>
      <div className="text-sm font-medium mt-0.5">{children ?? "—"}</div>
    </div>
  );
}

function MaintenanceForm({
  open, onOpenChange, onSubmit, loading, defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (d: any) => void;
  loading: boolean;
  defaultDate: string;
}) {
  const [d, setD] = useState<any>({ date: defaultDate, nextReviewDate: "", notes: "" });

  const submit = () => {
    if (!d.date) {
      toast({ title: "Indica la fecha del mantenimiento", variant: "destructive" });
      return;
    }
    onSubmit({
      date: d.date,
      nextReviewDate: d.nextReviewDate || null,
      notes: d.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo mantenimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
            </div>
            <div>
              <Label>Próxima revisión</Label>
              <Input type="date" value={d.nextReviewDate} onChange={(e) => setD({ ...d, nextReviewDate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea rows={3} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} placeholder="Trabajo realizado, piezas cambiadas, observaciones..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
