import { NextRequest, NextResponse } from "next/server";
import { requireUser, nextSequential } from "@/lib/session";
import { db } from "@/lib/db";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** POST: genera un Pedido de Compra a partir de un Presupuesto de Compra aceptado.
 *  Copia las líneas tal cual (sin descuento), enlaza sourcePurchaseQuoteId y hereda saleOrderId.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const quote = await db.purchaseQuote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote)
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });

  if (quote.status !== "ACCEPTED") {
    return NextResponse.json(
      {
        error:
          "El presupuesto debe estar marcado como ACEPTADO antes de generar un pedido",
      },
      { status: 400 }
    );
  }

  // No permitir duplicar: si ya hay un pedido que viene de este presupuesto, avisar.
  const existing = await db.purchaseOrder.findFirst({
    where: { sourcePurchaseQuoteId: id },
    select: { id: true, number: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Ya existe el pedido ${existing.number} generado desde este presupuesto`, existingId: existing.id },
      { status: 400 }
    );
  }

  const number = await nextSequential("purchaseOrder", "PDC");

  // Copiar líneas
  const linesData = quote.lines.map((l, idx) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const subtotal = round2(qty * price);
    return {
      articleId: l.articleId,
      description: l.description,
      quantity: qty,
      unitPrice: price,
      subtotal,
      sortOrder: l.sortOrder ?? idx,
    };
  });
  const total = round2(linesData.reduce((s, l) => s + l.subtotal, 0));

  const order = await db.purchaseOrder.create({
    data: {
      number,
      sourcePurchaseQuoteId: id,
      supplierId: quote.supplierId,
      saleOrderId: quote.saleOrderId,
      issueDate: new Date(),
      status: "PENDING",
      total,
      notes: `Generado desde presupuesto de compra del proveedor ${quote.supplierId}`,
      createdById: user.id,
      lines: { create: linesData },
    },
    include: {
      supplier: true,
      sourcePurchaseQuote: { select: { id: true } },
      saleOrder: {
        include: { client: { select: { id: true, name: true } } },
      },
      lines: { include: { article: true }, orderBy: { sortOrder: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(order, { status: 201 });
}
