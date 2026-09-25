import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]),
});

// Transiciones permitidas: DRAFT→SENT→ACCEPTED|REJECTED|EXPIRED.
// También se permite revertir a estados previos (para correcciones).
const VALID_FROM: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED", "DRAFT"],
  ACCEPTED: ["EXPIRED", "DRAFT"],
  REJECTED: ["DRAFT"],
  EXPIRED: ["DRAFT"],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  const newStatus = parsed.data.status;

  const quote = await db.saleQuote.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!quote) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const allowed = VALID_FROM[quote.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Transición no permitida: ${quote.status} → ${newStatus}` },
      { status: 400 }
    );
  }

  const updated = await db.saleQuote.update({
    where: { id },
    data: { status: newStatus },
  });

  // Audit log opcional (omitido por brevedad — el agente 2-e/2-g puede añadirlo)
  return NextResponse.json(updated);
}
