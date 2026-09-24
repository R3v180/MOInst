import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["PENDING", "PARTIAL_RECEIVED", "RECEIVED"]).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const order = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      sourcePurchaseQuote: {
        select: { id: true, issueDate: true, total: true, status: true },
      },
      saleOrder: {
        include: { client: { select: { id: true, name: true, city: true, phonePrimary: true } } },
      },
      lines: { include: { article: true }, orderBy: { sortOrder: "asc" } },
      albaranes: {
        orderBy: { date: "desc" },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!order)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Adjuntos polimórficos: del pedido y de sus albaranes
  const albaranIds = order.albaranes.map((a: any) => a.id);
  const [poAttachments, albaranAttachments] = await Promise.all([
    db.attachment.findMany({ where: { entityType: "PURCHASE_ORDER", entityId: id }, orderBy: { createdAt: "asc" } }),
    albaranIds.length
      ? db.attachment.findMany({ where: { entityType: "ALBARAN", entityId: { in: albaranIds } }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);
  const albaranAttMap: Record<string, any[]> = {};
  for (const a of albaranAttachments) (albaranAttMap[a.entityId] ||= []).push(a);
  order.albaranes = order.albaranes.map((a: any) => ({ ...a, attachments: albaranAttMap[a.id] ?? [] }));

  return NextResponse.json({ ...order, attachments: poAttachments });
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
  const existing = await db.purchaseOrder.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await db.purchaseOrder.update({
    where: { id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
    include: {
      supplier: true,
      sourcePurchaseQuote: { select: { id: true } },
      saleOrder: {
        include: { client: { select: { id: true, name: true } } },
      },
      lines: { include: { article: true }, orderBy: { sortOrder: "asc" } },
      albaranes: {
        orderBy: { date: "desc" },
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(updated);
}
