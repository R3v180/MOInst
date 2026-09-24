import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/installations/[id]/maintenances
//   Crea un mantenimiento (revisión) ligado a esta instalación.
// ─────────────────────────────────────────────────────────────────────────────
const createSchema = z.object({
  date: z.coerce.date(),
  nextReviewDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  // Verificar instalación
  const installation = await db.installation.findUnique({
    where: { id },
    select: { id: true, equipmentType: true, brand: true, model: true },
  });
  if (!installation) {
    return NextResponse.json({ error: "Instalación no encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Si la fecha de próxima revisión es anterior a la fecha de hoy, avisamos pero
  // permitimos crear (puede ser un mantenimiento histórico).
  const maintenance = await db.maintenance.create({
    data: {
      installationId: id,
      date: d.date,
      nextReviewDate: d.nextReviewDate ?? null,
      notes: d.notes ?? null,
      performedById: user.id,
    },
    include: {
      performedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(maintenance, { status: 201 });
}
