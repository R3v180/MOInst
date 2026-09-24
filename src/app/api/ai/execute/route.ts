import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { executeAction, type AiAction } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const action = (await req.json()) as AiAction;
  if (!action?.type) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });

  const result = await executeAction(action, user.id);

  // Registra en el log de IA que se ejecutó una acción
  try {
    await db.aiConversation.create({
      data: {
        userId: user.id,
        userMessage: `[CONFIRMACIÓN] Ejecutar acción ${action.type}`,
        aiResponse: result.summary,
        actionTaken: result.ok,
        actionSummary: `${action.type}: ${action.label ?? ""}`,
      },
    });
  } catch {}

  if (!result.ok) {
    return NextResponse.json({ error: result.summary }, { status: 400 });
  }
  return NextResponse.json({ ok: true, summary: result.summary, result: result.result });
}
