"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDateTime, formatDate, daysUntil, fullAddress } from "@/lib/format";
import {
  CalendarDays, Users, Wrench, Siren, FileText, ClipboardList, ShieldAlert, Sparkles,
  TrendingUp, MapPin, Clock, PackageX, Package,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const BAR_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-1)",
];

function MonthlySalesTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-semibold capitalize">{p.month}</div>
      <div className="text-muted-foreground">Total: {formatCurrency(p.total)}</div>
      <div className="text-muted-foreground">Pedidos: {p.count}</div>
    </div>
  );
}

export function DashboardView() {
  const { setView } = useAppStore();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/dashboard").then((r) => r.json()),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const c = data.counts;
  const cards = [
    { label: "Clientes", value: c.clients, icon: Users, view: "clients" as const, color: "text-primary" },
    { label: "Instalaciones", value: c.installations, icon: Wrench, view: "installations" as const, color: "text-primary" },
    { label: "Pedidos venta", value: c.saleOrders, icon: ClipboardList, view: "sale-orders" as const, color: "text-primary" },
    { label: "Incidencias abiertas", value: c.openIncidents, icon: Siren, view: "incidents" as const, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 moinst-section-gradient -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 rounded-lg">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel</h1>
          <p className="text-sm text-muted-foreground">
            Hola, {data.currentUser?.name}. Resumen de tu actividad.
          </p>
        </div>
        <Button onClick={() => useAppStore.getState().setAiPanelOpen(true)} className="bg-gradient-to-r from-primary to-primary/80">
          <Sparkles className="w-4 h-4 mr-2" />
          Preguntar a la IA
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => setView(card.view)}
              className="text-left"
            >
              <Card className="hover:shadow-md transition-shadow h-full moinst-card-hover">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-bold leading-none">{card.value}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{card.label}</div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Mini-chart de ventas mensuales + Stock bajo */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Ventas mensuales (6 meses)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("sale-orders")}>
              Ver pedidos
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.monthlySales ?? []}
                  margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="capitalize"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                    }
                    width={36}
                  />
                  <Tooltip
                    content={<MonthlySalesTooltip />}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {(data.monthlySales ?? []).map((_: any, i: number) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <PackageX className="w-4 h-4 text-destructive" /> Stock bajo
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("articles")}>
              Ver
            </Button>
          </CardHeader>
          <CardContent>
            {(data.lowStockArticles ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sin avisos de stock
              </p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto scroll-thin -mx-1">
                {(data.lowStockArticles ?? []).map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => setView("article-detail", { id: a.id })}
                    className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-accent border border-transparent hover:border-border"
                  >
                    <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.internalCode} · {a.category}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-destructive">
                        {a.stock} {a.unit}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        mín {a.stockMin} · Reponer
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Citas de hoy */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Hoy
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("agenda")}>
              Ver agenda
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.todayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No hay citas programadas para hoy
              </p>
            ) : (
              data.todayAppointments.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => a.client && setView("client-detail", { id: a.clientId })}
                  className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-accent border border-transparent hover:border-border"
                >
                  <div className="text-center shrink-0">
                    <div className="text-sm font-semibold">
                      {new Date(a.startAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {a.client?.name ?? a.notes ?? "Cita sin cliente"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {a.address || (a.client ? fullAddress(a.client) : "—")}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-muted">
                    {a.type.replace("_", " ")}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Presupuestos pendientes de respuesta */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Presupuestos enviados sin respuesta
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("sale-quotes")}>
              Ver todos
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.pendingQuotes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No hay presupuestos pendientes
              </p>
            ) : (
              data.pendingQuotes.map((q: any) => {
                const days = Math.floor((Date.now() - new Date(q.issueDate).getTime()) / 86400000);
                return (
                  <button
                    key={q.id}
                    onClick={() => setView("sale-quote-detail", { id: q.id })}
                    className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-accent border border-transparent hover:border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{q.number}</div>
                      <div className="text-xs text-muted-foreground truncate">{q.client?.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold">{formatCurrency(q.total)}</div>
                      <div className={`text-xs flex items-center gap-1 ${days > 7 ? "text-destructive" : "text-muted-foreground"}`}>
                        <Clock className="w-3 h-3" /> hace {days}d
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Incidencias abiertas */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Siren className="w-4 h-4 text-destructive" /> Incidencias abiertas
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("incidents")}>
              Ver todas
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.openIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No hay incidencias abiertas</p>
            ) : (
              data.openIncidents.map((i: any) => (
                <button
                  key={i.id}
                  onClick={() => setView("incident-detail", { id: i.id })}
                  className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-accent border border-transparent hover:border-border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{i.number}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {i.client?.name} · {[i.installation?.brand, i.installation?.model].filter(Boolean).join(" ")}
                    </div>
                  </div>
                  <StatusBadge kind="incident" value={i.status} />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Garantías próximas a caducar */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" /> Garantías a punto de caducar
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("installations")}>
              Ver instalaciones
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.warrantyExpiring.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No hay garantías próximas</p>
            ) : (
              data.warrantyExpiring.map((w: any) => (
                <button
                  key={w.id}
                  onClick={() => setView("installation-detail", { id: w.id })}
                  className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-accent border border-transparent hover:border-border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {[w.brand, w.model].filter(Boolean).join(" ") || w.equipmentType}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{w.client?.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">{formatDate(w.warrantyEndDate)}</div>
                    <div className={`text-xs font-medium ${w.daysLeft! < 7 ? "text-destructive" : "text-amber-600"}`}>
                      {w.daysLeft} días
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Citas de la semana */}
      {data.weekAppointments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Próximos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.weekAppointments.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => a.clientId && setView("client-detail", { id: a.clientId })}
                  className="text-left p-2 rounded-md hover:bg-accent border border-border"
                >
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(a.startAt)}
                  </div>
                  <div className="text-sm font-medium truncate">
                    {a.client?.name ?? a.notes ?? "Cita"}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
