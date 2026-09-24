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
  description: z.string().min(1, "La descripción de la línea es obligatoria"),
  quantity: z.number().min(0).default(1),
  unitPrice: z.number().min(0).default(0),
  sortOrder: z.number().int().default(0),
});

const createSchema = z.object({
  supplierId: z.string().min(1, "El proveedor es obligatorio"),
  saleOrderId: z.string().nullable().optional(),
  issueDate: z.string().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["RECEIVED", "ACCEPTED", "DISCARDED"]).optional(),
  lines: z.array(lineSchema).default([]),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const supplierId = sp.get("supplierId") ?? "";
  const saleOrderId = sp.get("saleOrderId") ?? "";
  const status = sp.get("status") ?? "";
  const includeMeta = sp.get("includeMeta") === "1";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)));

  const where: any = { AND: [] };
  if (supplierId) where.AND.push({ supplierId });
  if (saleOrderId) where.AND.push({ saleOrderId });
  if (status) where.AND.push({ status: status as any });
  if (q) {
    where.AND.push({
      OR: [
        { notes: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { saleOrder: { number: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const [total, items] = await Promise.all([
    db.purchaseQuote.count({ where }),
    db.purchaseQuote.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        saleOrder: {
          select: {
            id: true,
            number: true,
            client: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { name: true } },
        _count: { select: { lines: true, purchaseOrders: true } },
      },
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  let meta: { suppliers: any[]; saleOrders: any[] } | undefined;
  if (includeMeta) {
    const [suppliers, saleOrders] = await Promise.all([
      db.supplier.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, contactName: true },
      }),
      db.saleOrder.findMany({
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          number: true,
          client: { select: { id: true, name: true } },
        },
        take: 100,
      }),
    ]);
    meta = { suppliers, saleOrders };
  }

  return NextResponse.json({ items, total, page, pageSize, meta });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const supplier = await db.supplier.findUnique({ where: { id: d.supplierId } });
  if (!supplier)
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 400 });

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

  const lines = d.lines.map((l, idx) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const subtotal = round2(qty * price);
    return {
      articleId: l.articleId ?? null,
      description: l.description,
      quantity: qty,
      unitPrice: price,
      subtotal,
      sortOrder: l.sortOrder ?? idx,
    };
  });
  const total = round2(lines.reduce((s, l) => s + l.subtotal, 0));

  const quote = await db.purchaseQuote.create({
    data: {
      supplierId: d.supplierId,
      saleOrderId: d.saleOrderId ?? null,
      issueDate: d.issueDate ? new Date(d.issueDate) : new Date(),
      notes: d.notes ?? null,
      status: d.status ?? "RECEIVED",
      total,
      createdById: user.id,
      lines: { create: lines },
    },
    include: {
      supplier: true,
      saleOrder: { include: { client: { select: { id: true, name: true } } } },
      lines: { include: { article: true }, orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json(quote, { status: 201 });
}
