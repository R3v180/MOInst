import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { daysUntil } from "@/lib/format";

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
  ]);

  // Márgenes de garantía
  const warrantyWithDays = warrantyExpiring.map((i) => ({
    ...i,
    daysLeft: daysUntil(i.warrantyEndDate),
  }));

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
    currentUser: user,
  });
}
