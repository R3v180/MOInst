import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendEmail, isSmtpConfigured } from "@/lib/email";

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const configured = await isSmtpConfigured();
  if (!configured) {
    return NextResponse.json({ error: "SMTP no configurado. Ve a Ajustes → Email para configurarlo." }, { status: 400 });
  }

  const result = await sendEmail({
    to: parsed.data.to,
    subject: parsed.data.subject,
    text: parsed.data.text,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Error al enviar" }, { status: 400 });
  }

  // Registra en auditoría
  await db.aiConversation.create({
    data: {
      userId: user.id,
      userMessage: `[EMAIL ENVIADO] a ${parsed.data.to}`,
      aiResponse: parsed.data.subject,
      actionTaken: true,
      actionSummary: `Email enviado a ${parsed.data.to}: ${parsed.data.subject}`,
    },
  });

  return NextResponse.json({ ok: true, message: "Email enviado" });
}
