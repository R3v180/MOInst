import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/appointments/[id] — detalle con todas las relaciones
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const appointment = await db.appointment.findUnique({
    where: { id },
    include: {
      client: true,
      installation: { select: { id: true, brand: true, model: true, equipmentType: true } },
      saleOrder: { select: { id: true, number: true } },
      saleQuote: { select: { id: true, number: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  return NextResponse.json(appointment);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/appointments/[id] — actualiza campos (PATCH semántico)
// ─────────────────────────────────────────────────────────────────────────────
const updateSchema = z.object({
  type: z.enum(["QUOTE_VISIT", "INSTALLATION", "MAINTENANCE", "INCIDENT", "OTHER"]).optional(),
  startAt: z.coerce.date().optional(),
  durationMin: z.number().int().min(1).max(1440).optional(),
  clientId: z.string().nullable().optional(),
  installationId: z.string().nullable().optional(),
  saleOrderId: z.string().nullable().optional(),
  saleQuoteId: z.string().nullable().optional(),
  assignedToId: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["PENDING", "DONE", "CANCELLED"]).optional(),
});

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

  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  // Validar FKs si vienen en el payload
  if (d.clientId && d.clientId !== existing.clientId) {
    const c = await db.client.findUnique({ where: { id: d.clientId } });
    if (!c) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
  }
  if (d.installationId) {
    const i = await db.installation.findUnique({ where: { id: d.installationId } });
    if (!i) return NextResponse.json({ error: "Instalación no encontrada" }, { status: 400 });
  }
  if (d.saleOrderId) {
    const so = await db.saleOrder.findUnique({ where: { id: d.saleOrderId } });
    if (!so) return NextResponse.json({ error: "Pedido de venta no encontrado" }, { status: 400 });
  }
  if (d.saleQuoteId) {
    const sq = await db.saleQuote.findUnique({ where: { id: d.saleQuoteId } });
    if (!sq) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 400 });
  }
  if (d.assignedToId) {
    const u = await db.user.findUnique({ where: { id: d.assignedToId } });
    if (!u) return NextResponse.json({ error: "Usuario asignado no encontrado" }, { status: 400 });
  }

  const updated = await db.appointment.update({
    where: { id },
    data: d,
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(updated);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/appointments/[id]
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  try {
    await db.appointment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar la cita" }, { status: 400 });
  }
}
