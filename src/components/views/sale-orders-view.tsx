"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ClipboardList, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En curso" },
  { value: "INSTALLED", label: "Instalado" },
  { value: "CLOSED", label: "Cerrado" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "Pago (todos)" },
  { value: "PENDING", label: "Pendiente de cobro" },
  { value: "PAID", label: "Cobrado" },
];

export function SaleOrdersView() {
  const { setView } = useAppStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [clientId, setClientId] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["sale-orders", q, status, clientId, paymentStatus],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (status !== "all") p.set("status", status);
      if (clientId !== "all") p.set("clientId", clientId);
      if (paymentStatus !== "all") p.set("paymentStatus", paymentStatus);
      const r = await fetch(`/api/sale-orders?${p.toString()}`);
      return r.json();
    },
  });

  // Lista de clientes para el filtro
  const { data: clientsData } = useQuery({
    queryKey: ["clients", "", "", false],
    queryFn: () => fetch(`/api/clients?pageSize=100`).then((r) => r.json()),
  });
  const clients = clientsData?.items ?? [];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Pedidos de venta"
        description={`${total} pedidos`}
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número (PDV-...)"
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
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Pago" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_OPTIONS.map((o) => (
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
      </div>

      {/* Tabla */}
      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-y-auto scroll-thin divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="hidden md:block h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="hidden lg:block h-4 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" />}
          title="Sin pedidos de venta"
          description="Los pedidos se generan automáticamente desde un presupuesto aceptado."
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
                    <TableHead>Estado</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Incidencias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((o: any) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setView("sale-order-detail", { id: o.id })}
                    >
                      <TableCell className="font-medium">{o.number}</TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-[180px]">{o.client?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {o._count?.installations ?? 0} instal. · {o._count?.deliveryAlbaranes ?? 0} albaranes
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(o.issueDate)}</TableCell>
                      <TableCell><StatusBadge kind="saleOrder" value={o.status} /></TableCell>
                      <TableCell><StatusBadge kind="payment" value={o.paymentStatus} /></TableCell>
                      <TableCell className="hidden lg:table-cell text-center">
                        {(o._count?.incidents ?? 0) > 0 ? (
                          <span className="text-destructive font-medium">{o._count.incidents}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
