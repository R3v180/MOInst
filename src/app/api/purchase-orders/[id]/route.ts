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
        include: {
          uploadedBy: { select: { id: true, name: true } },
          attachments: {
            where: { entityType: "ALBARAN" },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      createdBy: { select: { id: true, name: true } },
      attachments: {
        where: { entityType: "PURCHASE_ORDER" },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(order);
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
          attachments: {
            where: { entityType: "ALBARAN" },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(updated);
}
