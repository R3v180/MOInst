import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), "upload");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityType: string; filename: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { entityType, filename } = await params;
  // Sanitiza: no permitir salir del dir
  if (filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }
  const diskPath = path.join(UPLOAD_ROOT, entityType.toLowerCase(), filename);
  try {
    const buf = await fs.readFile(diskPath);
    const ext = path.extname(filename).toLowerCase();
    let mime = "application/octet-stream";
    if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
    else if (ext === ".png") mime = "image/png";
    else if (ext === ".webp") mime = "image/webp";
    else if (ext === ".gif") mime = "image/gif";
    else if (ext === ".pdf") mime = "application/pdf";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=31536000",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }
}
