import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incidents/[id]/close  { resolution }
//   Marca status=CLOSED, closedAt=now, closedById=user.id, resolution=...
//   Bloquea si ya estaba CLOSED.
// ─────────────────────────────────────────────────────────────────────────────
const closeSchema = z.object({
  resolution: z.string().min(1, "La resolución es obligatoria"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await db.incident.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  if (existing.status === "CLOSED") {
    return NextResponse.json(
      { error: "La incidencia ya está cerrada" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const updated = await db.incident.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: user.id,
      resolution: parsed.data.resolution,
    },
    include: {
      client: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}
