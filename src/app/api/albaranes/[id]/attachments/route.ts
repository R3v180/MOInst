import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

/** GET attachments polimórficos para un albarán concreto. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const albaran = await db.albaran.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!albaran)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const attachments = await db.attachment.findMany({
    where: { entityType: "ALBARAN", entityId: id },
    orderBy: { createdAt: "asc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ items: attachments });
}
