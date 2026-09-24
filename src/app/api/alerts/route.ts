import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/alerts
//   Counts rápidos para badges en la navegación lateral.
//   Respuesta:
//     {
//       lowStockCount: number,         // artículos con stockMin > 0 y stock <= stockMin
//       openIncidentsCount: number,    // incidencias OPEN | IN_RESOLUTION
//       pendingQuotesCount: number,    // saleQuotes SENT (enviados sin respuesta)
//       expiringWarrantiesCount: number, // instalaciones ACTIVE con warrantyEndDate <= now+30d
//     }
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86400000);

  const [articlesLow, openIncidents, pendingQuotes, expiringWarranties] = await Promise.all([
    db.article.findMany({
      where: { stockMin: { gt: 0 } },
      select: { stock: true, stockMin: true },
    }),
    db.incident.count({
      where: { status: { in: ["OPEN", "IN_RESOLUTION"] } },
    }),
    db.saleQuote.count({ where: { status: "SENT" } }),
    db.installation.count({
      where: {
        status: "ACTIVE",
        warrantyEndDate: { gte: now, lte: in30d },
      },
    }),
  ]);

  // Stock bajo: filtrar en JS (Prisma no soporta comparar dos columnas).
  const lowStockCount = articlesLow.filter((a) => a.stock <= a.stockMin).length;

  return NextResponse.json({
    lowStockCount,
    openIncidentsCount: openIncidents,
    pendingQuotesCount: pendingQuotes,
    expiringWarrantiesCount: expiringWarranties,
  });
}
