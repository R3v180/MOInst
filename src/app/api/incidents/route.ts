import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser, nextSequential } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/incidents
//   Filtros: status (OPEN|IN_RESOLUTION|CLOSED), clientId, q por número.
//   Paginación. Cada item lleva client, installation (brand/model) y saleOrder.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status") ?? "";
  const clientId = sp.get("clientId") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "25", 10)));

  const where: any = { AND: [] };
  if (q) {
    where.AND.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (status) where.AND.push({ status });
  if (clientId) where.AND.push({ clientId });

  const [total, items] = await Promise.all([
    db.incident.count({ where }),
    db.incident.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, city: true } },
        installation: {
          select: {
            id: true,
            brand: true,
            model: true,
            serialNumber: true,
            equipmentType: true,
            status: true,
          },
        },
        saleOrder: { select: { id: true, number: true } },
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        _count: { select: { attachments: { where: { entityType: "INCIDENT" } } } },
      },
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incidents
//   Crea una incidencia. number = INC-AAAA-NNNN (nextSequential).
//   status = OPEN, openedAt = now, openedById = user.id.
//   Si installationId o saleOrderId vienen, validar FK y coherencia con client.
// ─────────────────────────────────────────────────────────────────────────────
const createSchema = z.object({
  clientId: z.string().min(1, "El cliente es obligatorio"),
  installationId: z.string().nullable().optional(),
  saleOrderId: z.string().nullable().optional(),
  description: z.string().min(1, "La descripción es obligatoria"),
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

  // Validar cliente
  const client = await db.client.findUnique({ where: { id: d.clientId } });
  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
  }

  // Si viene installationId, validar que exista y pertenezca al cliente
  if (d.installationId) {
    const inst = await db.installation.findUnique({
      where: { id: d.installationId },
      select: { id: true, clientId: true },
    });
    if (!inst) {
      return NextResponse.json({ error: "Instalación no encontrada" }, { status: 400 });
    }
    if (inst.clientId !== d.clientId) {
      return NextResponse.json(
        { error: "La instalación no pertenece al cliente indicado" },
        { status: 400 }
      );
    }
  }

  // Si viene saleOrderId, validar que exista y pertenezca al cliente
  if (d.saleOrderId) {
    const so = await db.saleOrder.findUnique({
      where: { id: d.saleOrderId },
      select: { id: true, clientId: true },
    });
    if (!so) {
      return NextResponse.json({ error: "Pedido de venta no encontrado" }, { status: 400 });
    }
    if (so.clientId !== d.clientId) {
      return NextResponse.json(
        { error: "El pedido de venta no pertenece al cliente indicado" },
        { status: 400 }
      );
    }
  }

  const number = await nextSequential("incident", "INC");

  const incident = await db.incident.create({
    data: {
      number,
      clientId: d.clientId,
      installationId: d.installationId ?? null,
      saleOrderId: d.saleOrderId ?? null,
      description: d.description,
      status: "OPEN",
      openedAt: new Date(),
      openedById: user.id,
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(incident, { status: 201 });
}
