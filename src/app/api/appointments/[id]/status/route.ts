import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/appointments/[id]/status
//   Body: { status: "PENDING" | "DONE" | "CANCELLED" }
// ─────────────────────────────────────────────────────────────────────────────
const statusSchema = z.object({
  status: z.enum(["PENDING", "DONE", "CANCELLED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _user = await requireUser();
  const { id } = await params;
  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Estado inválido" },
      { status: 400 }
    );
  }

  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const updated = await db.appointment.update({
    where: { id },
    data: { status: parsed.data.status },
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(updated);
}
