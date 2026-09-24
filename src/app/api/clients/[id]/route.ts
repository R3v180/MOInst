import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  nif: z.string().nullable().optional(),
  phonePrimary: z.string().nullable().optional(),
  phoneSecondary: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  addressStreet: z.string().nullable().optional(),
  addressNumber: z.string().nullable().optional(),
  addressFloor: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      installations: {
        include: { _count: { select: { incidents: true } } },
        orderBy: { installDate: "desc" },
      },
      saleQuotes: {
        orderBy: { issueDate: "desc" },
        take: 50,
        select: { id: true, number: true, status: true, total: true, issueDate: true },
      },
      saleOrders: {
        orderBy: { issueDate: "desc" },
        take: 50,
        select: { id: true, number: true, status: true, paymentStatus: true, issueDate: true },
      },
      incidents: {
        orderBy: { openedAt: "desc" },
        take: 50,
        include: { installation: { select: { id: true, brand: true, model: true } } },
      },
      appointments: {
        where: { startAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
        take: 10,
        include: { assignedTo: true },
      },
      createdBy: { select: { name: true } },
    },
  });
  if (!client) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const client = await db.client.update({ where: { id }, data: parsed.data });
  return NextResponse.json(client);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    await db.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar (puede tener instalaciones/pedidos asociados)" }, { status: 400 });
  }
}
