import { NextRequest, NextResponse } from "next/server";
import { requireUser, nextSequential } from "@/lib/session";
import { db } from "@/lib/db";

// POST /api/sale-quotes/[id]/generate-order
// Crea un SaleOrder copiando las líneas del presupuesto.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const quote = await db.saleQuote.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!quote) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });

  if (quote.status !== "ACCEPTED") {
    return NextResponse.json(
      { error: "El presupuesto debe estar ACEPTADO para generar un pedido" },
      { status: 400 }
    );
  }

  // Evitar generar duplicados: si ya existe un SaleOrder con sourceSaleQuoteId == id, devolver ese.
  const existing = await db.saleOrder.findFirst({
    where: { sourceSaleQuoteId: id },
    select: { id: true, number: true },
  });
  if (existing) {
    return NextResponse.json({ id: existing.id, number: existing.number, reused: true });
  }

  const number = await nextSequential("saleOrder", "PDV");

  // Copiar líneas (mismos campos)
  const lines = quote.lines.map((l, idx) => ({
    articleId: l.articleId,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discount: l.discount,
    subtotal: l.subtotal,
    isLabor: l.isLabor,
    sortOrder: l.sortOrder ?? idx,
  }));

  const order = await db.saleOrder.create({
    data: {
      number,
      sourceSaleQuoteId: id,
      clientId: quote.clientId,
      createdById: user.id,
      notes: `Generado desde presupuesto ${quote.number}`,
      lines: { create: lines },
    },
    include: {
      client: { select: { id: true, name: true } },
      lines: { include: { article: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json({ id: order.id, number: order.number }, { status: 201 });
}
