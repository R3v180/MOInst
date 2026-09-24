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
} as const;

// GET /api/users → { items: [...] }
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const items = await db.user.findMany({
    select: userPublic,
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ items });
}

const createSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional().nullable(),
  role: z.enum(["SOCIO", "ADMIN"]).default("SOCIO"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// POST /api/users → create with bcrypt-hashed password
export async function POST(req: NextRequest) {
  await requireUser();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const email = d.email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(d.password, 10);
  const created = await db.user.create({
    data: {
      name: d.name.trim(),
      email,
      phone: d.phone ?? null,
      role: d.role,
      passwordHash,
      active: true,
    },
    select: userPublic,
  });
  return NextResponse.json(created, { status: 201 });
}
