import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";
import { randomId } from "@/lib/utils";

const UPLOAD_ROOT = "/home/z/my-project/upload";

const VALID_ENTITY_TYPES = [
  "INSTALLATION",
  "PURCHASE_ORDER",
  "SALE_ORDER",
  "SALE_QUOTE",
  "PURCHASE_QUOTE",
  "ALBARAN",
  "INCIDENT",
];

function detectFileType(file: File): "PHOTO" | "PDF" | "EXCEL" | "OTHER" {
  if (file.type.startsWith("image/")) return "PHOTO";
  if (file.type === "application/pdf") return "PDF";
  if (
    file.type.includes("spreadsheet") ||
    file.type.includes("excel") ||
    file.name.match(/\.(xlsx?|csv)$/i)
  )
    return "EXCEL";
  return "OTHER";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const entityType = String(fd.get("entityType") ?? "");
  const entityId = String(fd.get("entityId") ?? "");

  if (!file) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  if (!VALID_ENTITY_TYPES.includes(entityType))
    return NextResponse.json({ error: "Tipo de entidad inválido" }, { status: 400 });
  if (!entityId)
    return NextResponse.json({ error: "Falta el entityId" }, { status: 400 });

  const fileType = detectFileType(file);
  const ext = path.extname(file.name) || (fileType === "PHOTO" ? ".jpg" : "");
  const safeName = `${randomId()}${ext.toLowerCase()}`;
  const relDir = path.join(entityType.toLowerCase());
  const diskDir = path.join(UPLOAD_ROOT, relDir);
  await fs.mkdir(diskDir, { recursive: true });
  const diskPath = path.join(diskDir, safeName);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(diskPath, buf);
  const filePath = `/api/uploads/${entityType.toLowerCase()}/${safeName}`;

  const att = await db.attachment.create({
    data: {
      entityType: entityType as any,
      entityId,
      fileType,
      filePath,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      uploadedById: user.id,
    },
  });

  return NextResponse.json(
    {
      id: att.id,
      fileName: att.fileName,
      filePath: att.filePath,
      fileType: att.fileType,
      mimeType: att.mimeType,
      url: att.filePath,
    },
    { status: 201 }
  );
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const entityType = sp.get("entityType");
  const entityId = sp.get("entityId");
  if (!entityType || !entityId)
    return NextResponse.json({ items: [] });
  const items = await db.attachment.findMany({
    where: { entityType: entityType as any, entityId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items });
}
