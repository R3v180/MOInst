import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_ROOT = "/home/z/my-project/upload";

// Include común: SaleOrder con cadena de trazabilidad completa
// (purchaseQuotes/purchaseOrders con proveedores y albaranes)
const saleOrderTraceInclude = {
  client: { select: { id: true, name: true } },
  purchaseQuotes: {
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { issueDate: "desc" },
  },
  purchaseOrders: {
    include: {
      supplier: { select: { id: true, name: true } },
      albaranes: {
        orderBy: { date: "desc" },
        include: {
          attachments: {
            where: { entityType: "ALBARAN" },
          },
        },
      },
    },
    orderBy: { issueDate: "desc" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/incidents/[id]
//   Devuelve la incidencia + client + installation (con su sourceSaleOrder y
//   cadena de trazabilidad) + saleOrder directo (si lo hay) + adjuntos
//   polimórficos (entityType=INCIDENT) + openedBy + closedBy.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const incident = await db.incident.findUnique({
    where: { id },
    include: {
      client: true,
      installation: {
        include: {
          client: { select: { id: true, name: true } },
          sourceSaleOrder: { include: saleOrderTraceInclude },
        },
      },
      saleOrder: { include: saleOrderTraceInclude },
      attachments: {
        where: { entityType: "INCIDENT" },
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
    },
  });

  if (!incident) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json(incident);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/incidents/[id]
//   Actualiza description / resolution / status.
// ─────────────────────────────────────────────────────────────────────────────
const updateSchema = z.object({
  description: z.string().min(1).optional(),
  resolution: z.string().nullable().optional(),
  status: z.enum(["OPEN", "IN_RESOLUTION", "CLOSED"]).optional(),
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

  const existing = await db.incident.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const data: any = {};
  if (d.description !== undefined) data.description = d.description;
  if (d.resolution !== undefined) data.resolution = d.resolution ?? null;
  if (d.status !== undefined) {
    data.status = d.status;
    // Si está pasando a CLOSED sin venir de un close explícito, sellamos campos
    if (d.status === "CLOSED" && !existing.closedAt) {
      data.closedAt = new Date();
      data.closedById = user.id;
    }
    // Si reabrimos (CLOSED → OPEN/IN_RESOLUTION), limpiar cierre
    if (existing.status === "CLOSED" && d.status !== "CLOSED") {
      data.closedAt = null;
      data.closedById = null;
      if (d.status === "OPEN") data.resolution = null;
    }
  }

  const updated = await db.incident.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(updated);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/incidents/[id]
//   Borra la incidencia y sus adjuntos (polimórficos entityType=INCIDENT) en
//   disco.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireUser();
  const { id } = await params;

  try {
    const atts = await db.attachment.findMany({
      where: { entityType: "INCIDENT", entityId: id },
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

    await db.incident.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo eliminar la incidencia" },
      { status: 400 }
    );
  }
}
