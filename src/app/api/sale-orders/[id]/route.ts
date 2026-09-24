import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "INSTALLED", "CLOSED"]).optional(),
  paymentStatus: z.enum(["PAID", "PENDING"]).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const order = await db.saleOrder.findUnique({
    where: { id },
    include: {
      client: true,
      sourceSaleQuote: { select: { id: true, number: true, status: true, total: true } },
      lines: {
        include: { article: { select: { id: true, name: true, internalCode: true } } },
        orderBy: { sortOrder: "asc" },
      },
      installations: {
        include: { client: { select: { id: true, name: true } } },
        orderBy: { installDate: "desc" },
      },
      purchaseQuotes: {
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { issueDate: "desc" },
      },
      purchaseOrders: {
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { issueDate: "desc" },
      },
      incidents: {
        include: { installation: { select: { id: true, brand: true, model: true } } },
        orderBy: { openedAt: "desc" },
      },
      deliveryAlbaranes: {
        include: {
          attachments: true,
          uploadedBy: { select: { name: true } },
        },
        orderBy: { date: "desc" },
      },
      appointments: {
        where: { startAt: { gte: new Date() } },
        include: { assignedTo: { select: { id: true, name: true } } },
        orderBy: { startAt: "asc" },
        take: 10,
      },
      createdBy: { select: { id: true, name: true } },
      attachments: true,
    },
  });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(order);
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

  const order = await db.saleOrder.update({
    where: { id },
    data: {
      ...(d.status ? { status: d.status } : {}),
      ...(d.paymentStatus ? { paymentStatus: d.paymentStatus } : {}),
      ...(Object.prototype.hasOwnProperty.call(d, "notes") ? { notes: d.notes ?? null } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(order);
}
