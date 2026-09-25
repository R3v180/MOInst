"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Truck, Search, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function PurchaseOrdersView() {
  const { setView } = useAppStore();
  const [q, setQ] = useState("");
  const [supplierId, setSupplierId] = useState("all");
  const [saleOrderId, setSaleOrderId] = useState("all");
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders", q, supplierId, saleOrderId, status],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("includeMeta", "1");
      if (q) p.set("q", q);
      if (supplierId !== "all") p.set("supplierId", supplierId);
      if (saleOrderId !== "all") p.set("saleOrderId", saleOrderId);
      if (status !== "all") p.set("status", status);
      const r = await fetch(`/api/purchase-orders?${p.toString()}`);
      return r.json();
    },
  });

  const items = data?.items ?? [];
  const suppliers = data?.meta?.suppliers ?? [];
  const saleOrders = data?.meta?.saleOrders ?? [];

  return (
    <div>
      <PageHeader
        title="Pedidos de compra"
        description={`${data?.total ?? 0} pedidos emitidos a proveedores`}
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número, proveedor, pedido de venta..."
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
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="PARTIAL_RECEIVED">Parcial</SelectItem>
            <SelectItem value="RECEIVED">Recibido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="divide-y divide-border min-w-[800px]">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-1 flex-1">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Truck className="w-6 h-6" />}
          title="Sin pedidos de compra"
          description="Los pedidos de compra se generan desde presupuestos de compra aceptados."
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Pedido de venta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Albaranes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it: any) => (
                  <TableRow
                    key={it.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setView("purchase-order-detail", { id: it.id })}
                  >
                    <TableCell className="font-mono font-medium">{it.number}</TableCell>
                    <TableCell>{it.supplier?.name ?? "—"}</TableCell>
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
                    <TableCell className="whitespace-nowrap">{formatDate(it.issueDate)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(it.total)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="purchaseOrder" value={it.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {it._count?.albaranes > 0 ? (
                        <span className="text-sm font-medium">{it._count.albaranes}</span>
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
    </div>
  );
}
