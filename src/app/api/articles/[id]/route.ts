import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  internalCode: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  articleType: z.enum(["SERIALIZED", "CONSUMABLE"]).optional(),
  unit: z.string().optional(),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  stock: z.number().optional(),
  stockMin: z.number().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const article = await db.article.findUnique({
    where: { id },
    include: {
      supplierPrices: {
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { priceDate: "desc" },
      },
      saleQuoteLines: {
        orderBy: { sortOrder: "asc" },
        take: 20,
        include: { saleQuote: { select: { id: true, number: true, issueDate: true, status: true, total: true, clientId: true, client: { select: { id: true, name: true } } } } },
      },
      saleOrderLines: {
        orderBy: { sortOrder: "asc" },
        take: 20,
        include: { saleOrder: { select: { id: true, number: true, issueDate: true, status: true, paymentStatus: true, clientId: true, client: { select: { id: true, name: true } } } } },
      },
    },
  });
  if (!article) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Determinar último precio por proveedor (el "actual")
  const bySupplier = new Map<string, { row: any; price: number; priceDate: Date }>();
  for (const ap of article.supplierPrices) {
    const cur = bySupplier.get(ap.supplierId);
    if (!cur || new Date(ap.priceDate).getTime() > new Date(cur.priceDate).getTime()) {
      bySupplier.set(ap.supplierId, { row: ap, price: ap.price, priceDate: new Date(ap.priceDate) });
    }
  }
  const currentPrices = Array.from(bySupplier.values()).map((v) => v.row);
  // ordenar por precio asc para mostrar "ranking"
  currentPrices.sort((a, b) => a.price - b.price);

  // Mejor precio actual
  const best = currentPrices[0] ?? null;

  return NextResponse.json({
    ...article,
    currentPrices,
    bestPrice: best
      ? {
          price: best.price,
          supplierId: best.supplierId,
          supplierName: best.supplier?.name ?? "",
          priceDate: best.priceDate,
          supplierRef: best.supplierRef ?? null,
          deliveryDays: best.deliveryDays ?? null,
        }
      : null,
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
  const d = parsed.data;
  // Si cambia internalCode, validar unicidad
  if (d.internalCode) {
    const dup = await db.article.findFirst({
      where: { internalCode: d.internalCode, NOT: { id } },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: `Ya existe otro artículo con código "${d.internalCode}"` },
        { status: 400 }
      );
    }
  }
  try {
    const article = await db.article.update({ where: { id }, data: d });
    return NextResponse.json(article);
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
    await db.article.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo eliminar (puede tener líneas de presupuesto/pedido asociadas)" },
      { status: 400 }
    );
  }
}
