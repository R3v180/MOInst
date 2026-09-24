import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/appointments
//   Filtros: assignedToId, startAtFrom, startAtTo, status, clientId, type.
//   Devuelve items (con client, installation, saleOrder, saleQuote, assignedTo)
//   ordenados por startAt asc.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const assignedToId = sp.get("assignedToId") ?? "";
  const startAtFrom = sp.get("startAtFrom") ?? "";
  const startAtTo = sp.get("startAtTo") ?? "";
  const status = sp.get("status") ?? "";
  const clientId = sp.get("clientId") ?? "";
  const type = sp.get("type") ?? "";

  const where: any = { AND: [] };
  if (assignedToId) where.AND.push({ assignedToId });
  if (status) where.AND.push({ status });
  if (clientId) where.AND.push({ clientId });
  if (type) where.AND.push({ type });
  if (startAtFrom) {
    const d = new Date(startAtFrom);
    if (!isNaN(d.getTime())) where.AND.push({ startAt: { gte: d } });
  }
  if (startAtTo) {
    const d = new Date(startAtTo);
    if (!isNaN(d.getTime())) where.AND.push({ startAt: { lte: d } });
  }

  if (where.AND && where.AND.length === 0) delete where.AND;
  const items = await db.appointment.findMany({
    where,
    include: {
      client: {
        select: {
          id: true,
          name: true,
          phonePrimary: true,
          addressStreet: true,
          addressNumber: true,
          addressFloor: true,
          postalCode: true,
          city: true,
          province: true,
        },
      },
      installation: { select: { id: true, brand: true, model: true, equipmentType: true } },
      saleOrder: { select: { id: true, number: true } },
      saleQuote: { select: { id: true, number: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ items });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/appointments
//   Body: type, startAt, durationMin?, clientId?, installationId?, saleOrderId?,
//         saleQuoteId?, address?, notes?, assignedToId?, status=PENDING
//   Si no se especifica assignedToId, se asigna al usuario actual.
//   Valida FKs (client, installation, saleOrder, saleQuote, assignedTo).
// ─────────────────────────────────────────────────────────────────────────────
const createSchema = z.object({
  type: z.enum(["QUOTE_VISIT", "INSTALLATION", "MAINTENANCE", "INCIDENT", "OTHER"]),
  startAt: z.coerce.date(),
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

  // Validar FKs opcionales
  if (d.clientId) {
    const c = await db.client.findUnique({ where: { id: d.clientId } });
    if (!c) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
  }
  if (d.installationId) {
    const i = await db.installation.findUnique({ where: { id: d.installationId } });
    if (!i) return NextResponse.json({ error: "Instalación no encontrada" }, { status: 400 });
    // Si hay installationId pero no clientId, heredar el cliente de la instalación
    if (!d.clientId) d.clientId = i.clientId;
  }
  if (d.saleOrderId) {
    const so = await db.saleOrder.findUnique({ where: { id: d.saleOrderId } });
    if (!so) return NextResponse.json({ error: "Pedido de venta no encontrado" }, { status: 400 });
  }
  if (d.saleQuoteId) {
    const sq = await db.saleQuote.findUnique({ where: { id: d.saleQuoteId } });
    if (!sq) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 400 });
  }

  // assignedTo: explícito, o el usuario actual
  const assignedToId = d.assignedToId ?? user.id;
  const asignee = await db.user.findUnique({ where: { id: assignedToId } });
  if (!asignee) return NextResponse.json({ error: "Usuario asignado no encontrado" }, { status: 400 });

  const appointment = await db.appointment.create({
    data: {
      type: d.type,
      startAt: d.startAt,
      durationMin: d.durationMin ?? 60,
      clientId: d.clientId ?? null,
      installationId: d.installationId ?? null,
      saleOrderId: d.saleOrderId ?? null,
      saleQuoteId: d.saleQuoteId ?? null,
      assignedToId,
      address: d.address ?? null,
      notes: d.notes ?? null,
      status: d.status ?? "PENDING",
    },
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(appointment, { status: 201 });
}
