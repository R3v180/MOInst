import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const lineSchema = z.object({
  id: z.string().optional(),
  articleId: z.string().nullable().optional(),
  description: z.string().min(1, "La descripción es obligatoria"),
  quantity: z.number().min(0).default(1),
  unitPrice: z.number().min(0).default(0),
  sortOrder: z.number().int().default(0),
});

const updateSchema = z.object({
  supplierId: z.string().min(1).optional(),
  saleOrderId: z.string().nullable().optional(),
  issueDate: z.string().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["RECEIVED", "ACCEPTED", "DISCARDED"]).optional(),
  lines: z.array(lineSchema).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const quote = await db.purchaseQuote.findUnique({
    where: { id },
    include: {
      supplier: true,
      saleOrder: {
        include: { client: { select: { id: true, name: true, city: true } } },
      },
      lines: { include: { article: true }, orderBy: { sortOrder: "asc" } },
      createdBy: { select: { id: true, name: true } },
      attachments: {
        where: { entityType: "PURCHASE_QUOTE" },
        orderBy: { createdAt: "asc" },
      },
      purchaseOrders: {
        select: { id: true, number: true, status: true, issueDate: true },
        orderBy: { issueDate: "desc" },
      },
    },
  });
  if (!quote)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(quote);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
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

  const existing = await db.purchaseQuote.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (d.supplierId) {
    const s = await db.supplier.findUnique({ where: { id: d.supplierId } });
    if (!s)
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 400 });
  }
  if (d.saleOrderId) {
    const so = await db.saleOrder.findUnique({
      where: { id: d.saleOrderId },
      select: { id: true },
    });
    if (!so)
      return NextResponse.json(
        { error: "Pedido de venta no encontrado" },
        { status: 400 }
      );
  }

  // Si hay líneas, reemplazamos
  let newTotal = existing.total;
  if (d.lines) {
    await db.purchaseQuoteLine.deleteMany({ where: { purchaseQuoteId: id } });
    const linesData = d.lines.map((l, idx) => {
      const qty = Number(l.quantity) || 0;
      const price = Number(l.unitPrice) || 0;
      const subtotal = round2(qty * price);
      return {
        purchaseQuoteId: id,
        articleId: l.articleId ?? null,
        description: l.description,
        quantity: qty,
        unitPrice: price,
        subtotal,
        sortOrder: l.sortOrder ?? idx,
      };
    });
    if (linesData.length > 0) {
      await db.purchaseQuoteLine.createMany({ data: linesData });
    }
    newTotal = round2(linesData.reduce((s, l) => s + l.subtotal, 0));
  }

  const updated = await db.purchaseQuote.update({
    where: { id },
    data: {
      ...(d.supplierId ? { supplierId: d.supplierId } : {}),
      ...(d.saleOrderId !== undefined ? { saleOrderId: d.saleOrderId } : {}),
      ...(d.issueDate ? { issueDate: new Date(d.issueDate) } : {}),
      ...(d.notes !== undefined ? { notes: d.notes } : {}),
      ...(d.status ? { status: d.status } : {}),
      total: newTotal,
    },
    include: {
      supplier: true,
      saleOrder: {
        include: { client: { select: { id: true, name: true, city: true } } },
      },
      lines: { include: { article: true }, orderBy: { sortOrder: "asc" } },
      createdBy: { select: { id: true, name: true } },
      attachments: {
        where: { entityType: "PURCHASE_QUOTE" },
        orderBy: { createdAt: "asc" },
      },
      purchaseOrders: {
        select: { id: true, number: true, status: true, issueDate: true },
        orderBy: { issueDate: "desc" },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const existing = await db.purchaseQuote.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // No permitir borrar si ya generó pedidos
  const ordersCount = await db.purchaseOrder.count({
    where: { sourcePurchaseQuoteId: id },
  });
  if (ordersCount > 0) {
    return NextResponse.json(
      {
        error: `No se puede borrar: ya se generaron ${ordersCount} pedido(s) de compra desde este presupuesto`,
      },
      { status: 400 }
    );
  }

  // Borrar attachments del disco ( PURCHASE_QUOTE )
  const atts = await db.attachment.findMany({
    where: { entityType: "PURCHASE_QUOTE", entityId: id },
  });
  const fs = await import("fs/promises");
  const path = await import("path");
  const UPLOAD_ROOT = "/home/z/my-project/upload";
  for (const a of atts) {
    try {
      const rel = a.filePath.split("/api/uploads/")[1];
      if (rel) await fs.unlink(path.join(UPLOAD_ROOT, rel));
    } catch {}
  }
  if (atts.length > 0) {
    await db.attachment.deleteMany({
      where: { id: { in: atts.map((a) => a.id) } },
    });
  }

  await db.purchaseQuote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
