import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { daysUntil } from "@/lib/format";

const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const [
    todayAppointments,
    weekAppointments,
    pendingQuotes,
    openOrders,
    openIncidents,
    warrantyExpiring,
    pendingMaintenances,
    counts,
    recentClients,
    stats,
    monthlySalesRaw,
    lowStockArticles,
    recentClients3,
    recentSaleQuotes3,
    recentSaleOrders3,
    recentIncidents3,
    recentInstallations3,
  ] = await Promise.all([
    db.appointment.findMany({
      where: { startAt: { gte: startOfDay, lt: endOfDay }, status: "PENDING" },
      include: { client: true, assignedTo: true },
      orderBy: { startAt: "asc" },
    }),
    db.appointment.findMany({
      where: { startAt: { gte: endOfDay, lt: endOfWeek }, status: "PENDING" },
      include: { client: true },
      orderBy: { startAt: "asc" },
    }),
    db.saleQuote.findMany({
      where: { status: "SENT" },
      include: { client: true },
      orderBy: { issueDate: "desc" },
    }),
    db.saleOrder.findMany({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
      include: { client: true },
      orderBy: { issueDate: "desc" },
    }),
    db.incident.findMany({
      where: { status: { in: ["OPEN", "IN_RESOLUTION"] } },
      include: { client: true, installation: true },
      orderBy: { openedAt: "desc" },
    }),
    db.installation.findMany({
      where: { status: "ACTIVE", warrantyEndDate: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) } },
      include: { client: true },
      orderBy: { warrantyEndDate: "asc" },
      take: 10,
    }),
    db.maintenance.findMany({
      where: { nextReviewDate: { lt: endOfWeek } },
      include: { installation: { include: { client: true } } },
      orderBy: { nextReviewDate: "asc" },
      take: 10,
    }),
    Promise.all([
      db.client.count(),
      db.installation.count(),
      db.saleOrder.count(),
      db.incident.count({ where: { status: { in: ["OPEN", "IN_RESOLUTION"] } } }),
      db.appointment.count({ where: { status: "PENDING", startAt: { gte: startOfDay } } }),
    ]),
    db.client.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { _count: { select: { installations: true, saleOrders: true } } } }),
    db.saleQuote.groupBy({ by: ["status"], _count: true }),
    // ─── Ventas mensuales (6 meses) ───
    // Se traen los SaleOrder de los últimos 6 meses con status INSTALLED|CLOSED
    // y se agrupan en JS por mes (el camp issueDate es DateTime).
    db.saleOrder.findMany({
      where: {
        status: { in: ["INSTALLED", "CLOSED"] },
        issueDate: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
      },
      select: {
        issueDate: true,
        lines: { select: { subtotal: true, isLabor: true } },
      },
    }),
    // ─── Stock bajo (artículos con stockMin > 0 y stock <= stockMin) ───
    // Prisma no soporta comparar dos columnas en where; traemos los que tienen
    // stockMin > 0 y filtramos en JS.
    db.article.findMany({
      where: { stockMin: { gt: 0 } },
      select: {
        id: true,
        internalCode: true,
        name: true,
        category: true,
        stock: true,
        stockMin: true,
        unit: true,
      },
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      take: 50,
    }),
    // ─── Actividad reciente: top 3 de cada tipo, ordenados por createdAt desc ───
    // Se mezclan todos en JS, se ordenan por createdAt desc y se toman 8.
    // Cada item se normaliza a { id, type, label, sublabel, createdAt, status? }.
    db.client.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        name: true,
        city: true,
        phonePrimary: true,
        createdAt: true,
      },
    }),
    db.saleQuote.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        client: { select: { name: true } },
      },
    }),
    db.saleOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        client: { select: { name: true } },
      },
    }),
    // Incident opener es `createdBy` (relación "IncidentOpenedBy"), NO `openedBy`.
    // El modelo tiene `openedAt` y `createdAt`; usamos `createdAt` para el timeline
    // (cuando se registró la incidencia en el sistema).
    db.incident.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        client: { select: { name: true } },
        installation: { select: { brand: true, model: true, equipmentType: true } },
      },
    }),
    db.installation.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        equipmentType: true,
        brand: true,
        model: true,
        status: true,
        createdAt: true,
        client: { select: { name: true } },
      },
    }),
  ]);

  // ── Construir recentActivity (merge + sort + take 8) ──
  type ActivityType = "client" | "saleQuote" | "saleOrder" | "incident" | "installation";
  interface ActivityItem {
    id: string;
    type: ActivityType;
    label: string;
    sublabel: string;
    createdAt: string;
    status?: string;
  }
  const activityItems: ActivityItem[] = [];
  for (const c of recentClients3) {
    activityItems.push({
      id: c.id,
      type: "client",
      label: c.name,
      sublabel: [c.city, c.phonePrimary].filter(Boolean).join(" · ") || "Nuevo cliente",
      createdAt: c.createdAt,
    });
  }
  for (const q of recentSaleQuotes3) {
    activityItems.push({
      id: q.id,
      type: "saleQuote",
      label: q.number,
      sublabel: q.client?.name ?? "—",
      createdAt: q.createdAt,
      status: q.status,
    });
  }
  for (const o of recentSaleOrders3) {
    activityItems.push({
      id: o.id,
      type: "saleOrder",
      label: o.number,
      sublabel: o.client?.name ?? "—",
      createdAt: o.createdAt,
      status: o.status,
    });
  }
  for (const i of recentIncidents3) {
    const instLabel = i.installation
      ? [i.installation.brand, i.installation.model].filter(Boolean).join(" ") || i.installation.equipmentType
      : null;
    activityItems.push({
      id: i.id,
      type: "incident",
      label: i.number,
      sublabel: [i.client?.name, instLabel].filter(Boolean).join(" · ") || "Incidencia",
      createdAt: i.createdAt,
      status: i.status,
    });
  }
  for (const inst of recentInstallations3) {
    const instLabel = [inst.brand, inst.model].filter(Boolean).join(" ") || inst.equipmentType;
    activityItems.push({
      id: inst.id,
      type: "installation",
      label: instLabel,
      sublabel: inst.client?.name ?? "—",
      createdAt: inst.createdAt,
      status: inst.status,
    });
  }
  activityItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentActivity = activityItems.slice(0, 8);

  // Márgenes de garantía
  const warrantyWithDays = warrantyExpiring.map((i) => ({
    ...i,
    daysLeft: daysUntil(i.warrantyEndDate),
  }));

  // ── Agrupar ventas mensuales en JS ──
  // Generamos los 6 meses (incluido el actual) con init {total:0, count:0}.
  const monthlySales: { month: string; total: number; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlySales.push({
      month: MONTH_LABELS[d.getMonth()],
      total: 0,
      count: 0,
    });
  }
  // Índice por (año*12+mes) para localizar rápido
  const monthIdx = (y: number, m: number) => {
    const baseY = now.getFullYear();
    const baseM = now.getMonth();
    const diff = (y - baseY) * 12 + (m - baseM);
    // diff es relativo al mes actual (0 = actual); 5 - diff para índice (0..5)
    return 5 - diff;
  };
  for (const s of monthlySalesRaw) {
    const d = new Date(s.issueDate);
    const idx = monthIdx(d.getFullYear(), d.getMonth());
    if (idx >= 0 && idx < 6) {
      // SaleOrder no tiene campo `total`; se calcula desde las líneas.
      const orderTotal = (s.lines ?? []).reduce((sum: number, l: any) => sum + (l.subtotal ?? 0), 0);
      monthlySales[idx].total += orderTotal;
      monthlySales[idx].count += 1;
    }
  }

  // ── Filtrar artículos en stock bajo en JS (stock <= stockMin) ──
  const lowStock = lowStockArticles
    .filter((a) => a.stock <= a.stockMin)
    .slice(0, 10);

  return NextResponse.json({
    todayAppointments,
    weekAppointments,
    pendingQuotes,
    openOrders,
    openIncidents,
    warrantyExpiring: warrantyWithDays,
    pendingMaintenances,
    counts: {
      clients: counts[0],
      installations: counts[1],
      saleOrders: counts[2],
      openIncidents: counts[3],
      upcomingAppointments: counts[4],
    },
    recentClients,
    stats: stats.map((s) => ({ status: s.status, count: s._count })),
    monthlySales,
    lowStockArticles: lowStock,
    recentActivity,
    currentUser: user,
  });
}
