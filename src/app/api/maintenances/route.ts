import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/maintenances
//   Lista de mantenimientos con filtros opcionales:
//     installationId  → mantenimientos de una instalación concreta
//     clientId        → mantenimientos cuya instalación pertenece a un cliente
//     dateFrom/dateTo → rango por `date`
//     performedById   → mantenimientos realizados por un usuario
//   Cada item incluye `installation` (con `client`) y `performedBy` (User).
//   Paginación: page, pageSize (default 25, máx 100). Orden: date DESC.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const installationId = sp.get("installationId") ?? "";
  const clientId = sp.get("clientId") ?? "";
  const dateFrom = sp.get("dateFrom") ?? "";
  const dateTo = sp.get("dateTo") ?? "";
  const performedById = sp.get("performedById") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "25", 10)));

  const where: any = { AND: [] };
  if (installationId) where.AND.push({ installationId });
  if (clientId) where.AND.push({ installation: { clientId } });
  if (performedById) where.AND.push({ performedById });
  if (dateFrom) where.AND.push({ date: { gte: new Date(dateFrom) } });
  if (dateTo) where.AND.push({ date: { lte: new Date(dateTo) } });
  // Guard: Prisma rechaza `AND: []` vacío.
  if (where.AND.length === 0) delete where.AND;

  const [total, items] = await Promise.all([
    db.maintenance.count({ where }),
    db.maintenance.findMany({
      where,
      include: {
        installation: {
          include: { client: { select: { id: true, name: true, city: true } } },
        },
        performedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}
