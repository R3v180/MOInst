import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const userPublic = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: userPublic });
  if (!u) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(u);
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(["SOCIO", "ADMIN"]).optional(),
  active: z.boolean().optional(),
  // optional new password — if provided, hash with bcrypt
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  if (d.email) {
    const email = d.email.toLowerCase().trim();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 400 });
    }
    d.email = email;
  }

  const data: Record<string, unknown> = { ...d };
  if (d.password) {
    data.passwordHash = await bcrypt.hash(d.password, 10);
    delete data.password;
  }

  const updated = await db.user.update({
    where: { id },
    data: data as never,
    select: userPublic,
  });
  return NextResponse.json(updated);
}

// PATCH /api/users/[id] → { active: boolean } toggles active state
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== "boolean") {
    return NextResponse.json({ error: "Falta 'active' (boolean)" }, { status: 400 });
  }
  const updated = await db.user.update({
    where: { id },
    data: { active: body.active },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
    },
  });
  return NextResponse.json(updated);
}
