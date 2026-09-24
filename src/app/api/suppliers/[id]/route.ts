import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      articlePrices: {
        include: { article: { select: { id: true, internalCode: true, name: true, category: true, unit: true } } },
        orderBy: { priceDate: "desc" },
      },
      _count: { select: { purchaseQuotes: true, purchaseOrders: true } },
    },
  });
  if (!supplier) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Último precio por artículo (el "actual")
  const byArticle = new Map<string, { row: any; priceDate: Date }>();
  for (const ap of supplier.articlePrices) {
    const cur = byArticle.get(ap.articleId);
    if (!cur || new Date(ap.priceDate).getTime() > new Date(cur.priceDate).getTime()) {
      byArticle.set(ap.articleId, { row: ap, priceDate: new Date(ap.priceDate) });
    }
  }
  const currentPrices = Array.from(byArticle.values())
    .map((v) => v.row)
    .sort((a, b) => (a.article?.name ?? "").localeCompare(b.article?.name ?? ""));

  // Conteo de histórico por artículo (para mostrar "N precios históricos")
  const historyCount: Record<string, number> = {};
  for (const ap of supplier.articlePrices) {
    historyCount[ap.articleId] = (historyCount[ap.articleId] ?? 0) + 1;
  }

  return NextResponse.json({
    ...supplier,
    currentPrices,
    historyCount,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireUser();
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const supplier = await db.supplier.update({ where: { id }, data: parsed.data });
    return NextResponse.json(supplier);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error al actualizar" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireUser();
  const { id } = await params;
  try {
    await db.supplier.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo eliminar (puede tener presupuestos/pedidos de compra asociados)" },
      { status: 400 }
    );
  }
}
