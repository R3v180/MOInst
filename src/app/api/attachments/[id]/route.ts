import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_ROOT = "/home/z/my-project/upload";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const atts = await db.attachment.findMany({
    where: { entityType: { in: [] as any } }, // nunca: usar con query
    take: 0,
  });
  return NextResponse.json({ atts });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const att = await db.attachment.findUnique({ where: { id } });
  if (!att) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Borrar archivo del disco
  try {
    // filePath es /api/uploads/{type}/{filename}; extraemos partes
    const parts = att.filePath.split("/api/uploads/")[1];
    if (parts) {
      const disk = path.join(UPLOAD_ROOT, parts);
      await fs.unlink(disk);
    }
  } catch {}

  await db.attachment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
