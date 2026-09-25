import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// POST /api/sale-orders/[id]/install
// Marca el pedido como INSTALLED y crea o vincula instalaciones.
// Body: { items: [{ mode: "new" | "link", clientId?, installationId?, equipmentType, brand, model, serialNumber, location, warrantyEndDate? }] }

const newInstSchema = z.object({
  mode: z.literal("new"),
  clientId: z.string().min(1),
  equipmentType: z.string().min(1),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  warrantyEndDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const linkInstSchema = z.object({
  mode: z.literal("link"),
  installationId: z.string().min(1),
});

const bodySchema = z.object({
  items: z.array(z.union([newInstSchema, linkInstSchema])).min(1, "Añade al menos una instalación"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const order = await db.saleOrder.findUnique({
    where: { id },
    select: { id: true, status: true, clientId: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  if (order.status === "CLOSED") {
    return NextResponse.json({ error: "El pedido ya está cerrado" }, { status: 400 });
  }

  const created: { id: string; serialNumber: string | null; brand: string | null; model: string | null; mode: string }[] = [];

  for (const item of parsed.data.items) {
    if (item.mode === "new") {
      // Crear Installation
      const inst = await db.installation.create({
        data: {
          clientId: item.clientId,
          equipmentType: item.equipmentType,
          brand: item.brand ?? null,
          model: item.model ?? null,
          serialNumber: item.serialNumber ?? null,
          location: item.location ?? null,
          warrantyEndDate: item.warrantyEndDate ? new Date(item.warrantyEndDate) : null,
          notes: item.notes ?? null,
          sourceSaleOrderId: id,
          createdById: user.id,
          status: "ACTIVE",
        },
        select: { id: true, serialNumber: true, brand: true, model: true },
      });
      created.push({ ...inst, mode: "new" });
    } else {
      // Vincular existente: le pone sourceSaleOrderId = id
      const inst = await db.installation.update({
        where: { id: item.installationId },
        data: { sourceSaleOrderId: id },
        select: { id: true, serialNumber: true, brand: true, model: true },
      });
      created.push({ ...inst, mode: "link" });
    }
  }

  // Marca pedido como INSTALLED
  await db.saleOrder.update({
    where: { id },
    data: { status: "INSTALLED" },
  });

  return NextResponse.json({ ok: true, installations: created });
}
