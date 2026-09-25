import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/installations/[id]/attachments
//   Devuelve los adjuntos (polimórficos) asociados a esta instalación:
//   entityType=INSTALLATION, entityId=id.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  // Verificar que la instalación exista (404 si no)
  const exists = await db.installation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Instalación no encontrada" }, { status: 404 });
  }

  const items = await db.attachment.findMany({
    where: { entityType: "INSTALLATION", entityId: id },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ items });
}
