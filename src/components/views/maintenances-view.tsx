"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/format";
import { Wrench, Loader2, Filter, CalendarRange, User as UserIcon, X } from "lucide-react";

export function MaintenancesView() {
  const { setView } = useAppStore();
  const [clientId, setClientId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [performedById, setPerformedById] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Lista de mantenimientos con filtros
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["maintenances", clientId, dateFrom, dateTo, performedById, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (clientId !== "all") p.set("clientId", clientId);
      if (dateFrom) p.set("dateFrom", dateFrom);
      if (dateTo) p.set("dateTo", dateTo);
      if (performedById !== "all") p.set("performedById", performedById);
      p.set("page", String(page));
      p.set("pageSize", String(pageSize));
      const r = await fetch(`/api/maintenances?${p.toString()}`);
      if (!r.ok) throw new Error("Error al cargar mantenimientos");
      return r.json();
    },
  });

  // Lista de clientes para el filtro
  const { data: clientsData } = useQuery({
    queryKey: ["clients", "", "", false],
    queryFn: () => fetch(`/api/clients?pageSize=200`).then((r) => r.json()),
  });
  const clients = clientsData?.items ?? [];

  // Lista de usuarios (técnicos) para el filtro
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetch(`/api/users`).then((r) => r.json()),
  });
  const users = (usersData as any)?.items ?? (Array.isArray(usersData) ? usersData : []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const onFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const hasFilters =
    clientId !== "all" || dateFrom !== "" || dateTo !== "" || performedById !== "all";

  const clearFilters = () => {
    setClientId("all");
    setDateFrom("");
    setDateTo("");
    setPerformedById("all");
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Mantenimientos"
        description={`${total} ${total === 1 ? "registro" : "registros"} de mantenimiento`}
      />

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Cliente */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                <Filter className="w-3 h-3" /> Cliente
              </Label>
              <Select value={clientId} onValueChange={onFilterChange(setClientId)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha desde */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                <CalendarRange className="w-3 h-3" /> Desde
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => onFilterChange(setDateFrom)(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Fecha hasta */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                <CalendarRange className="w-3 h-3" /> Hasta
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => onFilterChange(setDateTo)(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Realizado por */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                <UserIcon className="w-3 h-3" /> Realizado por
              </Label>
              <Select value={performedById} onValueChange={onFilterChange(setPerformedById)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Cualquier técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquier técnico</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-3.5 h-3.5 mr-1" /> Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-6 h-6" />}
          title="Sin mantenimientos"
          description={
            hasFilters
              ? "No hay registros que coincidan con los filtros seleccionados."
              : "Los mantenimientos se registran desde la ficha de cada instalación. Abre una instalación y pulsa «Nuevo mantenimiento»."
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Instalación</TableHead>
                    <TableHead className="w-[120px]">Próxima revisión</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="w-[140px]">Realizado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m: any) => {
                    const inst = m.installation;
                    const client = inst?.client;
                    const instLabel = inst
                      ? [inst.brand, inst.model].filter(Boolean).join(" ") || inst.equipmentType
                      : "—";
                    const nextReview = m.nextReviewDate ? formatDate(m.nextReviewDate) : "—";
                    const notes = m.notes?.trim() || "—";
                    return (
                      <TableRow
                        key={m.id}
                        className="cursor-pointer"
                        onClick={() =>
                          m.installationId &&
                          setView("installation-detail", { id: m.installationId })
                        }
                      >
                        <TableCell className="font-medium text-primary whitespace-nowrap">
                          {formatDate(m.date)}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {client?.name ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{instLabel}</span>
                          </div>
                        </TableCell>
                        <TableCell className={m.nextReviewDate ? "font-medium" : "text-muted-foreground"}>
                          {nextReview}
                        </TableCell>
                        <TableCell className="max-w-[280px] text-muted-foreground truncate">
                          {notes}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.performedBy?.name ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-6">
              <p className="text-xs text-muted-foreground">
                Página {page} de {totalPages} · {total} resultados
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isFetching}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
