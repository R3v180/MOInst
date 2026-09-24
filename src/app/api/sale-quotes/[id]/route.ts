import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const lineInputSchema = z.object({
  id: z.string().optional(),
  articleId: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).max(100),
  isLabor: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const updateSchema = z.object({
  clientId: z.string().optional(),
  installationId: z.string().nullable().optional(),
  issueDate: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(lineInputSchema).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const quote = await db.saleQuote.findUnique({
    where: { id },
    include: {
      client: true,
      installation: { include: { client: { select: { id: true, name: true } } } },
      lines: {
        include: { article: { include: { supplierPrices: { orderBy: { priceDate: "desc" }, take: 1 } } } },
        orderBy: { sortOrder: "asc" },
      },
      createdBy: { select: { id: true, name: true } },
      saleOrders: { select: { id: true, number: true, status: true, paymentStatus: true, issueDate: true } },
    },
  });
  if (!quote) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Adjuntar plantilla de email + nombre de empresa (Setting)
  const settings = await db.setting.findMany({
    where: { key: { in: ["emailTemplateQuote", "companyName"] } },
    select: { key: true, value: true },
  });
  const settingsMap: Record<string, any> = {};
  for (const s of settings) settingsMap[s.key] = s.value;

  return NextResponse.json({ ...quote, settings: settingsMap });
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await db.saleQuote.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Si se actualizan líneas, recalcula y reemplaza
  let laborTotal: number | undefined;
  let total: number | undefined;
  if (d.lines) {
    const lines = d.lines.map((l, idx) => {
      const qty = Number(l.quantity) || 0;
      const price = Number(l.unitPrice) || 0;
      const disc = Number(l.discount) || 0;
      const subtotal = round2(qty * price * (1 - disc / 100));
      return {
        articleId: l.articleId ?? null,
        description: l.description,
        quantity: qty,
        unitPrice: price,
        discount: disc,
        subtotal,
        isLabor: l.isLabor,
        sortOrder: l.sortOrder ?? idx,
      };
    });
    laborTotal = round2(lines.filter((l) => l.isLabor).reduce((s, l) => s + l.subtotal, 0));
    total = round2(lines.reduce((s, l) => s + l.subtotal, 0));

    await db.saleQuoteLine.deleteMany({ where: { saleQuoteId: id } });
    await db.saleQuoteLine.createMany({
      data: lines.map((l) => ({ ...l, saleQuoteId: id })),
    });
  }

  const updated = await db.saleQuote.update({
    where: { id },
    data: {
      ...(d.clientId ? { clientId: d.clientId } : {}),
      ...(Object.prototype.hasOwnProperty.call(d, "installationId") ? { installationId: d.installationId ?? null } : {}),
      ...(d.issueDate ? { issueDate: new Date(d.issueDate) } : {}),
      ...(Object.prototype.hasOwnProperty.call(d, "validUntil") ? { validUntil: d.validUntil ? new Date(d.validUntil) : null } : {}),
      ...(Object.prototype.hasOwnProperty.call(d, "notes") ? { notes: d.notes ?? null } : {}),
      ...(laborTotal !== undefined ? { laborTotal } : {}),
      ...(total !== undefined ? { total } : {}),
    },
    include: {
      client: true,
      installation: { select: { id: true, brand: true, model: true, equipmentType: true } },
      lines: { include: { article: true }, orderBy: { sortOrder: "asc" } },
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
  const existing = await db.saleQuote.findUnique({
    where: { id },
    select: { id: true, status: true, _count: { select: { saleOrders: true } } },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (existing._count.saleOrders > 0) {
    return NextResponse.json({ error: "No se puede eliminar: ya tiene pedidos de venta generados" }, { status: 400 });
  }
  try {
    await db.saleQuote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 400 });
  }
}
