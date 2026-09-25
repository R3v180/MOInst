import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["RECEIVED", "ACCEPTED", "DISCARDED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireUser();
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Estado inválido" },
      { status: 400 }
    );
  }
  const existing = await db.purchaseQuote.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await db.purchaseQuote.update({
    where: { id },
    data: { status: parsed.data.status },
    include: {
      supplier: { select: { id: true, name: true } },
      saleOrder: { select: { id: true, number: true } },
    },
  });
  return NextResponse.json(updated);
}
