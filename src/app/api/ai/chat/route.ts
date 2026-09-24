import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import {
  AI_SYSTEM_PROMPT,
  executeReadQuery,
  parseAiResponse,
  type ReadQuery,
} from "@/lib/ai/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { message, history = [] }: { message: string; history?: ChatMessage[] } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  // Construye la conversación para el modelo
  const messages: ChatMessage[] = [
    { role: "assistant", content: AI_SYSTEM_PROMPT },
    // Inyecta un resumen rápido del contexto actual (usuarios disponibles para asignar citas, etc.)
    {
      role: "assistant",
      content:
        `Contexto: usuario actual id=${user.id}, nombre=${user.name}, rol=${user.role}. Para crear citas, usa assignedToId=${user.id} por defecto.`,
    },
    ...history.slice(-10),
    { role: "user", content: message },
  ];

  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch (e: any) {
    return NextResponse.json(
      { error: "No se pudo inicializar el asistente IA", detail: e.message },
      { status: 500 }
    );
  }

  // Bucle agéntico: hasta 3 rondas para permitir consultas de lectura
  let finalText = "";
  let actions: any[] = [];
  let usedQueries = 0;
  const MAX_ROUNDS = 3;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let completion: any;
    try {
      completion = await zai.chat.completions.create({
        messages: messages as any,
        thinking: { type: "disabled" },
      });
    } catch (e: any) {
      return NextResponse.json(
        { error: "Error del modelo IA", detail: e.message },
        { status: 502 }
      );
    }
    const raw = completion?.choices?.[0]?.message?.content ?? "";

    const parsed = parseAiResponse(raw);
    // Acumula texto (si hay), solo del primer round con texto real
    if (parsed.text && !finalText) finalText = parsed.text;
    else if (parsed.text) finalText += "\n\n" + parsed.text;

    if (parsed.actions.length > 0) {
      actions.push(...parsed.actions);
    }

    if (parsed.queries.length === 0 || usedQueries >= 4) {
      // No hay más consultas, terminamos
      break;
    }

    // Ejecuta las consultas y alimenta al modelo
    for (const q of parsed.queries) {
      usedQueries++;
      const result = await executeReadQuery(q);
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content:
          `[RESULTADO DE CONSULTA — model=${(q as ReadQuery).model}]\n` +
          JSON.stringify(result, null, 2).slice(0, 6000) +
          `\n\nUsa este resultado para redactar la respuesta final al usuario. No menciones el JSON ni el bloque de query. Responde en español de forma concisa.`,
      });
    }
  }

  if (!finalText && actions.length > 0) {
    finalText =
      "He preparado la siguiente acción. Revísala y pulsa «Aplicar» para confirmarla (no se guardará hasta que lo hagas).";
  } else if (!finalText) {
    finalText = "(sin respuesta)";
  }

  // Persiste la conversación (auditoría)
  try {
    await db.aiConversation.create({
      data: {
        userId: user.id,
        userMessage: message,
        aiResponse: finalText + (actions.length ? `\n\n[Acciones propuestas: ${actions.length}]` : ""),
        actionTaken: false,
        actionSummary: actions.length
          ? actions.map((a) => a.label ?? a.type).join(" | ")
          : null,
      },
    });
  } catch {}

  return NextResponse.json({
    text: finalText || "(sin respuesta)",
    actions,
  });
}
