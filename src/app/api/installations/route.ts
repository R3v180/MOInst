import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/installations
//   Filtros: q (serial/brand/model/client.name), equipmentType, status,
//   page, pageSize. Devuelve items + total + meta (installationTypes,
//   defaultWarrantyMonths) para que la vista pueble selects y sugiera fin
//   de garantía.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const equipmentType = sp.get("equipmentType") ?? "";
  const status = sp.get("status") ?? "";
  const clientId = sp.get("clientId") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "24", 10)));

  const where: any = { AND: [] };
  if (q) {
    where.AND.push({
      OR: [
        { serialNumber: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (equipmentType) where.AND.push({ equipmentType });
  if (status) where.AND.push({ status });
  if (clientId) where.AND.push({ clientId });

  const [total, items, installationTypesSetting, warrantySetting] = await Promise.all([
    db.installation.count({ where }),
    db.installation.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, city: true } },
        sourceSaleOrder: { select: { id: true, number: true } },
        _count: {
          select: {
            incidents: { where: { status: { in: ["OPEN", "IN_RESOLUTION"] } } },
            maintenances: true,
          },
        },
      },
      orderBy: { installDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.setting.findUnique({ where: { key: "installationTypes" } }),
    db.setting.findUnique({ where: { key: "defaultWarrantyMonths" } }),
  ]);

  const installationTypes: string[] = Array.isArray(installationTypesSetting?.value)
    ? (installationTypesSetting!.value as any)
    : ["aire acondicionado", "caldera", "termo", "otro"];
  const defaultWarrantyMonths: number =
    typeof warrantySetting?.value === "number"
      ? (warrantySetting.value as number)
      : 24;

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    meta: { installationTypes, defaultWarrantyMonths },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/installations
// ─────────────────────────────────────────────────────────────────────────────
const createSchema = z.object({
  clientId: z.string().min(1, "El cliente es obligatorio"),
  equipmentType: z.string().min(1, "El tipo de equipo es obligatorio"),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  installDate: z.coerce.date(),
  warrantyEndDate: z.coerce.date().nullable().optional(),
  sourceSaleOrderId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "REMOVED", "REPLACED"]).optional(),
  notes: z.string().nullable().optional(),
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

  // Si viene sourceSaleOrderId, validar que exista
  if (d.sourceSaleOrderId) {
    const so = await db.saleOrder.findUnique({ where: { id: d.sourceSaleOrderId } });
    if (!so) {
      return NextResponse.json({ error: "Pedido de venta no encontrado" }, { status: 400 });
    }
  }

  const installation = await db.installation.create({
    data: {
      clientId: d.clientId,
      equipmentType: d.equipmentType,
      brand: d.brand ?? null,
      model: d.model ?? null,
      serialNumber: d.serialNumber ?? null,
      location: d.location ?? null,
      installDate: d.installDate,
      warrantyEndDate: d.warrantyEndDate ?? null,
      sourceSaleOrderId: d.sourceSaleOrderId ?? null,
      status: d.status ?? "ACTIVE",
      notes: d.notes ?? null,
      createdById: user.id,
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(installation, { status: 201 });
}
