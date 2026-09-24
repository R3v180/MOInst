import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_ROOT = "/home/z/my-project/upload";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/installations/[id]
//   Devuelve la instalación + cliente, pedido de venta origen, adjuntos,
//   incidencias, mantenimientos (con performedBy.name) y presupuestos
//   relacionados.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const installation = await db.installation.findUnique({
    where: { id },
    include: {
      client: true,
      sourceSaleOrder: {
        select: {
          id: true,
          number: true,
          issueDate: true,
          status: true,
          paymentStatus: true,
          client: { select: { id: true, name: true } },
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
      },
      incidents: {
        orderBy: { openedAt: "desc" },
        include: {
          client: { select: { id: true, name: true } },
        },
      },
      maintenances: {
        orderBy: { date: "desc" },
        include: {
          performedBy: { select: { id: true, name: true } },
        },
      },
      saleQuotes: {
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          issueDate: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!installation) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  return NextResponse.json(installation);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/installations/[id]
// ─────────────────────────────────────────────────────────────────────────────
const updateSchema = z.object({
  clientId: z.string().min(1).optional(),
  equipmentType: z.string().min(1).optional(),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  installDate: z.coerce.date().optional(),
  warrantyEndDate: z.coerce.date().nullable().optional(),
  sourceSaleOrderId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "REMOVED", "REPLACED"]).optional(),
  notes: z.string().nullable().optional(),
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

  // Verificar existencia
  const existing = await db.installation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  // Validar FKs si vienen en el payload
  if (d.clientId && d.clientId !== existing.clientId) {
    const c = await db.client.findUnique({ where: { id: d.clientId } });
    if (!c) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
  }
  if (d.sourceSaleOrderId) {
    const so = await db.saleOrder.findUnique({ where: { id: d.sourceSaleOrderId } });
    if (!so) return NextResponse.json({ error: "Pedido de venta no encontrado" }, { status: 400 });
  }

  const updated = await db.installation.update({
    where: { id },
    data: d,
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/installations/[id]
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  try {
    // Borrar adjuntos físicos + registros polimórficos
    const atts = await db.attachment.findMany({
      where: { entityType: "INSTALLATION", entityId: id },
      select: { id: true, filePath: true },
    });
    if (atts.length) {
      for (const a of atts) {
        try {
          const parts = a.filePath.split("/api/uploads/")[1];
          if (parts) {
            const disk = path.join(UPLOAD_ROOT, parts);
            await fs.unlink(disk);
          }
        } catch {}
      }
      await db.attachment.deleteMany({
        where: { id: { in: atts.map((a) => a.id) } },
      });
    }

    await db.installation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "No se pudo eliminar (puede tener incidencias o citas asociadas)" },
      { status: 400 }
    );
  }
}
