import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const albaran = await db.albaran.findUnique({
    where: { id },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          number: true,
          supplier: { select: { id: true, name: true } },
        },
      },
      saleOrder: {
        select: {
          id: true,
          number: true,
          client: { select: { id: true, name: true } },
        },
      },
      uploadedBy: { select: { id: true, name: true } },
      attachments: {
        where: { entityType: "ALBARAN" },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!albaran)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(albaran);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireUser();
  const { id } = await params;
  const existing = await db.albaran.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Borrar attachments del disco asociados a este albarán
  const atts = await db.attachment.findMany({
    where: { entityType: "ALBARAN", entityId: id },
  });
  const fs = await import("fs/promises");
  const path = await import("path");
  const UPLOAD_ROOT = "/home/z/my-project/upload";
  for (const a of atts) {
    try {
      const rel = a.filePath.split("/api/uploads/")[1];
      if (rel) await fs.unlink(path.join(UPLOAD_ROOT, rel));
    } catch {}
  }
  if (atts.length > 0) {
    await db.attachment.deleteMany({
      where: { id: { in: atts.map((a) => a.id) } },
    });
  }

  await db.albaran.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
