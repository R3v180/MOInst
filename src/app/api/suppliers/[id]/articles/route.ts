import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// Asocia un artículo existente a este proveedor creando una nueva fila
// ArticleSupplier con priceDate=now (NUNCA sobrescribe — preserva histórico).
const schema = z.object({
  articleId: z.string().min(1),
  price: z.number().nonnegative(),
  supplierRef: z.string().optional().nullable(),
  deliveryDays: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Si se quiere forzar una fecha concreta en vez de "ahora":
  priceDate: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireUser();
  const { id: supplierId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Validar que el proveedor y el artículo existen
  const [supplier, article] = await Promise.all([
    db.supplier.findUnique({ where: { id: supplierId }, select: { id: true, name: true } }),
    db.article.findUnique({ where: { id: d.articleId }, select: { id: true, name: true } }),
  ]);
  if (!supplier) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  if (!article) return NextResponse.json({ error: "Artículo no encontrado" }, { status: 404 });

  const priceDate = d.priceDate ? new Date(d.priceDate) : new Date();

  // La restricción única [articleId,supplierId,priceDate] impide duplicados exactos.
  try {
    const row = await db.articleSupplier.create({
      data: {
        articleId: d.articleId,
        supplierId,
        price: d.price,
        supplierRef: d.supplierRef ?? null,
        deliveryDays: d.deliveryDays ?? null,
        notes: d.notes ?? null,
        priceDate,
      },
      include: {
        article: { select: { id: true, name: true, internalCode: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    // Si choca la restricción única, añadimos 1 segundo al priceDate
    if (e?.code === "P2002") {
      const retryDate = new Date(priceDate.getTime() + 1000);
      try {
        const row = await db.articleSupplier.create({
          data: {
            articleId: d.articleId,
            supplierId,
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
    return NextResponse.json({ error: e?.message ?? "Error al asociar" }, { status: 400 });
  }
}
