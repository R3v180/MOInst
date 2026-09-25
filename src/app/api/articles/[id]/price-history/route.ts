import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

// Devuelve TODO el histórico de precios (todas las filas ArticleSupplier del artículo)
// para alimentar el gráfico. Incluye nombre del proveedor para leyenda/series.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const rows = await db.articleSupplier.findMany({
    where: { articleId: id },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { priceDate: "asc" },
  });

  // Agrupamos por supplierId para que el frontend pueda dibujar series por proveedor
  const suppliersMap = new Map<string, { id: string; name: string }>();
  for (const r of rows) {
    if (!suppliersMap.has(r.supplierId)) {
      suppliersMap.set(r.supplierId, { id: r.supplierId, name: r.supplier?.name ?? "Proveedor" });
    }
  }

  return NextResponse.json({
    articleId: id,
    suppliers: Array.from(suppliersMap.values()),
    rows: rows.map((r) => ({
      id: r.id,
      articleId: r.articleId,
      supplierId: r.supplierId,
      supplierName: r.supplier?.name ?? "Proveedor",
      price: r.price,
      priceDate: r.priceDate,
      supplierRef: r.supplierRef,
      deliveryDays: r.deliveryDays,
      notes: r.notes,
    })),
  });
}
