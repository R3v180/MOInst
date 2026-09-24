import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// GET /api/settings → { key: value, ... }
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await db.setting.findMany();
  const map: Record<string, unknown> = {};
  for (const row of rows) map[row.key] = row.value;
  return NextResponse.json(map);
}

// PUT /api/settings → body { key: value, ... } → upserts each and returns the new map
const putSchema = z.record(z.string(), z.unknown());

export async function PUT(req: NextRequest) {
  await requireUser();
  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const data = parsed.data;
  await Promise.all(
    Object.entries(data).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value: value as never },
        create: { key, value: value as never },
      }),
    ),
  );
  const rows = await db.setting.findMany();
  const map: Record<string, unknown> = {};
  for (const row of rows) map[row.key] = row.value;
  return NextResponse.json(map);
}
