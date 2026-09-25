import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/installations/[id]/maintenances/[mid]
//   Borra un mantenimiento concreto de la instalación.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const user = await requireUser();
  const { id, mid } = await params;

  // Verificar que el mantenimiento pertenece a la instalación
  const m = await db.maintenance.findUnique({
    where: { id: mid },
    select: { id: true, installationId: true },
  });
  if (!m || m.installationId !== id) {
    return NextResponse.json(
      { error: "Mantenimiento no encontrado para esta instalación" },
      { status: 404 }
    );
  }

  await db.maintenance.delete({ where: { id: mid } });
  return NextResponse.json({ ok: true });
}
