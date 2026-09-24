"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { FileText, Plus, Search, Loader2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "SENT", label: "Enviado" },
  { value: "ACCEPTED", label: "Aceptado" },
  { value: "REJECTED", label: "Rechazado" },
  { value: "EXPIRED", label: "Caducado" },
];

export function SaleQuotesView() {
  const { setView } = useAppStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [clientId, setClientId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sale-quotes", q, status, clientId, dateFrom, dateTo],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (status !== "all") p.set("status", status);
      if (clientId !== "all") p.set("clientId", clientId);
      if (dateFrom) p.set("dateFrom", dateFrom);
      if (dateTo) p.set("dateTo", dateTo);
      const r = await fetch(`/api/sale-quotes?${p.toString()}`);
      return r.json();
    },
  });

  // Cargar lista de clientes para el filtro y para el diálogo de creación
  const { data: clientsData } = useQuery({
    queryKey: ["clients", "", "", false],
    queryFn: async () => {
      const r = await fetch(`/api/clients?pageSize=100`);
      return r.json();
    },
  });
  const clients = clientsData?.items ?? [];

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/sale-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al crear presupuesto");
      }
      return r.json();
    },
    onSuccess: (quote) => {
      toast({ title: "Presupuesto creado", description: quote.number });
      qc.invalidateQueries({ queryKey: ["sale-quotes"] });
      setShowNew(false);
      setView("sale-quote-detail", { id: quote.id });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Presupuestos de venta"
        description={`${total} presupuestos`}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo presupuesto
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número (PV-...)"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-full sm:w-36"
          aria-label="Desde"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-full sm:w-36"
          aria-label="Hasta"
        />
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="Sin presupuestos"
          description="Crea tu primer presupuesto para un cliente."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nuevo presupuesto
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-y-auto scroll-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Emisión</TableHead>
                    <TableHead className="hidden lg:table-cell">Válido hasta</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((q: any) => (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setView("sale-quote-detail", { id: q.id })}
                    >
                      <TableCell className="font-medium">{q.number}</TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-[180px]">{q.client?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{q.client?.city ?? ""}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(q.issueDate)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatDate(q.validUntil)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(q.total)}</TableCell>
                      <TableCell><StatusBadge kind="saleQuote" value={q.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogo nuevo presupuesto */}
      <NewQuoteDialog
        open={showNew}
        onOpenChange={setShowNew}
        clients={clients}
        loading={createMut.isPending}
        onSubmit={(d) => createMut.mutate(d)}
      />
    </div>
  );
}

function NewQuoteDialog({
  open, onOpenChange, clients, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: any[];
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!clientId) {
      toast({ title: "Selecciona un cliente", variant: "destructive" });
      return;
    }
    onSubmit({
      clientId,
      issueDate: issueDate || undefined,
      validUntil: validUntil || null,
      notes: notes || null,
      lines: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo presupuesto de venta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Cliente *</Label>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                No hay clientes. <button onClick={() => useAppStore.getState().setView("clients")} className="text-primary underline">Crear cliente</button>
              </p>
            ) : (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha emisión</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Válido hasta</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notas internas</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas visibles para el equipo" />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Se creará en estado Borrador. Podrás añadir líneas y cambiar el estado desde el detalle.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || !clientId}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
