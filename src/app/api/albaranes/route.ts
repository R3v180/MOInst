import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  type: z.enum(["SUPPLIER_IN", "CLIENT_DELIVERY"]),
  purchaseOrderId: z.string().nullable().optional(),
  saleOrderId: z.string().nullable().optional(),
  date: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? "";
  const purchaseOrderId = sp.get("purchaseOrderId") ?? "";
  const saleOrderId = sp.get("saleOrderId") ?? "";
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const includeMeta = sp.get("includeMeta") === "1";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)));

  const where: any = { AND: [] };
  if (type) where.AND.push({ type: type as any });
  if (purchaseOrderId) where.AND.push({ purchaseOrderId });
  if (saleOrderId) where.AND.push({ saleOrderId });
  if (dateFrom || dateTo) {
    const range: any = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo);
      d.setDate(d.getDate() + 1);
      range.lt = d;
    }
    where.AND.push({ date: range });
  }
  // Prisma rechaza AND vacío; si no hay filtros, usar objeto vacío
  if (where.AND.length === 0) delete where.AND;

  const [total, items] = await Promise.all([
    db.albaran.count({ where }),
    db.albaran.findMany({
      where,
      include: {
        purchaseOrder: {
          select: {
            id: true,
            number: true,
            supplier: { select: { id: true, name: true } },
          },
        },
        saleOrder: {
          select: {
            id: true,
            number: true,
            client: { select: { id: true, name: true } },
          },
        },
        uploadedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Conteo de adjuntos polimórficos (no hay FK, se consulta por entityType+entityId)
  const attCounts = await db.attachment.groupBy({
    by: ["entityId"],
    where: { entityType: "ALBARAN", entityId: { in: items.map((a: any) => a.id) } },
    _count: { _all: true },
  });
  const attMap = Object.fromEntries(attCounts.map((c) => [c.entityId, c._count._all]));
  const itemsWithCounts = items.map((a: any) => ({ ...a, attachmentCount: attMap[a.id] ?? 0 }));

  let meta:
    | { purchaseOrders: any[]; saleOrders: any[] }
    | undefined;
  if (includeMeta) {
    const [purchaseOrders, saleOrders] = await Promise.all([
      db.purchaseOrder.findMany({
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          number: true,
          supplier: { select: { id: true, name: true } },
        },
        take: 100,
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
    meta = { purchaseOrders, saleOrders };
  }

  return NextResponse.json({ items: itemsWithCounts, total, page, pageSize, meta });
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

  // Validar vínculos
  if (d.type === "SUPPLIER_IN") {
    if (!d.purchaseOrderId) {
      return NextResponse.json(
        { error: "Un albarán de entrada requiere un pedido de compra" },
        { status: 400 }
      );
    }
    const po = await db.purchaseOrder.findUnique({
      where: { id: d.purchaseOrderId },
      select: { id: true, saleOrderId: true },
    });
    if (!po)
      return NextResponse.json(
        { error: "Pedido de compra no encontrado" },
        { status: 400 }
      );
    // Heredar saleOrderId del pedido si no se especifica
    if (!d.saleOrderId && po.saleOrderId) {
      d.saleOrderId = po.saleOrderId;
    }
  }
  if (d.type === "CLIENT_DELIVERY") {
    if (!d.saleOrderId) {
      return NextResponse.json(
        { error: "Un albarán de entrega a cliente requiere un pedido de venta" },
        { status: 400 }
      );
    }
  }
  if (d.purchaseOrderId) {
    const po = await db.purchaseOrder.findUnique({
      where: { id: d.purchaseOrderId },
      select: { id: true },
    });
    if (!po)
      return NextResponse.json(
        { error: "Pedido de compra no encontrado" },
        { status: 400 }
      );
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

  const albaran = await db.albaran.create({
    data: {
      type: d.type,
      purchaseOrderId: d.purchaseOrderId ?? null,
      saleOrderId: d.saleOrderId ?? null,
      date: d.date ? new Date(d.date) : new Date(),
      notes: d.notes ?? null,
      uploadedById: user.id,
    },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          number: true,
          supplier: { select: { id: true, name: true } },
        },
      },
      saleOrder: {
        select: {
          id: true,
          number: true,
          client: { select: { id: true, name: true } },
        },
      },
      uploadedBy: { select: { id: true, name: true } },
    },
  });
  // Adjuntos polimórficos (sin FK)
  const createdAttachments = await db.attachment.findMany({
    where: { entityType: "ALBARAN", entityId: albaran.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ ...albaran, attachments: createdAttachments }, { status: 201 });
}
