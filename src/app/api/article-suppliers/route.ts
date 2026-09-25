import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// Creación genérica de fila ArticleSupplier (histórico: nunca sobrescribe).
// Útil desde la vista de detalle de artículo para asociar proveedor + precio.
const schema = z.object({
  articleId: z.string().min(1),
  supplierId: z.string().min(1),
  price: z.number().nonnegative(),
  supplierRef: z.string().optional().nullable(),
  deliveryDays: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  priceDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  await requireUser();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Validar referencias
  const [article, supplier] = await Promise.all([
    db.article.findUnique({ where: { id: d.articleId }, select: { id: true } }),
    db.supplier.findUnique({ where: { id: d.supplierId }, select: { id: true, name: true } }),
  ]);
  if (!article) return NextResponse.json({ error: "Artículo no encontrado" }, { status: 404 });
  if (!supplier) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });

  const priceDate = d.priceDate ? new Date(d.priceDate) : new Date();

  try {
    const row = await db.articleSupplier.create({
      data: {
        articleId: d.articleId,
        supplierId: d.supplierId,
        price: d.price,
        supplierRef: d.supplierRef ?? null,
        deliveryDays: d.deliveryDays ?? null,
        notes: d.notes ?? null,
        priceDate,
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      // Misma fecha exacta: reintentar +1s
      const retryDate = new Date(priceDate.getTime() + 1000);
      try {
        const row = await db.articleSupplier.create({
          data: {
            articleId: d.articleId,
            supplierId: d.supplierId,
            price: d.price,
            supplierRef: d.supplierRef ?? null,
            deliveryDays: d.deliveryDays ?? null,
            notes: d.notes ?? null,
            priceDate: retryDate,
          },
        });
        return NextResponse.json(row, { status: 201 });
      } catch (e2: any) {
        return NextResponse.json(
          { error: "Ya existe un precio con esa fecha exacta" },
          { status: 400 }
        );
      }
    }
    return NextResponse.json({ error: e?.message ?? "Error al crear precio" }, { status: 400 });
  }
}
