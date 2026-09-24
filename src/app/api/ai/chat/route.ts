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
import { parseAttachedFile, buildAttachmentInstruction, looksLikePriceList, extractPriceListRows, buildMatchedPriceListInstruction } from "@/lib/ai/file-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Acepta JSON (sin archivo) o FormData (con archivo adjunto)
  const contentType = req.headers.get("content-type") ?? "";
  let message = "";
  let history: ChatMessage[] = [];
  let parsedFile: Awaited<ReturnType<typeof parseAttachedFile>> | null = null;

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    message = (fd.get("message") as string) ?? "";
    const histRaw = fd.get("history") as string | null;
    if (histRaw) {
      try { history = JSON.parse(histRaw); } catch {}
    }
    const file = fd.get("file") as File | null;
    if (file && file.size > 0) {
      // límite ~5MB
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Archivo demasiado grande (máx 5MB)" }, { status: 413 });
      }
      try {
        parsedFile = await parseAttachedFile(file);
      } catch (e: any) {
        return NextResponse.json({ error: "No se pudo parsear el archivo", detail: e.message }, { status: 400 });
      }
    }
  } else {
    const body = await req.json();
    message = body.message ?? "";
    history = body.history ?? [];
  }

  if (!message?.trim() && !parsedFile) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  // Contenido final del mensaje del usuario.
  // Si hay archivo y parece una lista de precios, hacemos MATCHING en BD antes
  // de llamar al LLM para que reciba articleIds concretos y proponga acciones directamente.
  let userContent: string;
  let matchedSummary: { matched: number; notFound: number; supplier?: string } | null = null;

  if (parsedFile && looksLikePriceList(parsedFile)) {
    const priceRows = extractPriceListRows(parsedFile);
    if (priceRows.length > 0) {
      // Detectar proveedor mencionado en el mensaje del usuario (búsqueda por nombre)
      let supplierHint: { id: string; name: string } | null = null;
      const suppliers = await db.supplier.findMany({ select: { id: true, name: true } });
      const msgLower = message.toLowerCase();
      for (const s of suppliers) {
        if (s.name && msgLower.includes(s.name.toLowerCase())) {
          supplierHint = s;
          break;
        }
      }

      // Matching de artículos por nombre (contains, insensitive) o internalCode
      const matched = await Promise.all(
        priceRows.slice(0, 30).map(async (row) => {
          let article: { id: string; name: string; internalCode: string } | undefined = undefined;
          if (row.reference) {
            const byCode = await db.article.findFirst({
              where: { internalCode: { equals: row.reference, mode: "insensitive" } },
              select: { id: true, name: true, internalCode: true },
            });
            if (byCode) article = byCode;
          }
          if (!article && row.name) {
            const byName = await db.article.findFirst({
              where: { name: { contains: row.name, mode: "insensitive" } },
              select: { id: true, name: true, internalCode: true },
            });
            if (byName) article = byName;
          }
          return { input: row, article };
        })
      );

      userContent = buildMatchedPriceListInstruction(parsedFile, message || "(sin mensaje)", matched, supplierHint);
      matchedSummary = {
        matched: matched.filter((m) => m.article).length,
        notFound: matched.filter((m) => !m.article).length,
        supplier: supplierHint?.name,
      };
    } else {
      userContent = buildAttachmentInstruction(parsedFile, message || "(sin mensaje adicional)");
    }
  } else if (parsedFile) {
    userContent = buildAttachmentInstruction(parsedFile, message || "(sin mensaje adicional)");
  } else {
    userContent = message;
  }

  // Construye la conversación para el modelo
  // Contexto enriquecido: fecha actual + counts + listas de entidades (names+ids)
  // para que el modelo pueda hacer matching directo sin consultar (acelera create flows)
  let quickContext = `Contexto: usuario actual id=${user.id}, nombre=${user.name}, rol=${user.role}. Para crear citas, usa assignedToId=${user.id} por defecto. Fecha actual: ${new Date().toISOString().slice(0, 10)}.`;
  try {
    const [clients, articles, suppliers, openIncidents] = await Promise.all([
      db.client.findMany({ select: { id: true, name: true, phonePrimary: true, city: true }, take: 30, orderBy: { name: "asc" } }),
      db.article.findMany({ select: { id: true, name: true, internalCode: true, category: true }, take: 30, orderBy: { name: "asc" } }),
      db.supplier.findMany({ select: { id: true, name: true }, take: 20, orderBy: { name: "asc" } }),
      db.incident.count({ where: { status: { in: ["OPEN", "IN_RESOLUTION"] } } }),
    ]);
    quickContext += `\nResumen BD: ${clients.length} clientes, ${articles.length} artículos, ${suppliers.length} proveedores, ${openIncidents} incidencias abiertas.`;
    // Listas para matching directo (el modelo NO necesita consultar para hallar IDs)
    if (clients.length > 0) {
      quickContext += "\n\nCLIENTES (id | nombre | teléfono | ciudad):\n" + clients.map(c => `- ${c.id} | ${c.name} | ${c.phonePrimary ?? "—"} | ${c.city ?? "—"}`).join("\n");
    }
    if (articles.length > 0) {
      quickContext += "\n\nARTÍCULOS (id | nombre | código | categoría):\n" + articles.map(a => `- ${a.id} | ${a.name} | ${a.internalCode} | ${a.category}`).join("\n");
    }
    if (suppliers.length > 0) {
      quickContext += "\n\nPROVEEDORES (id | nombre):\n" + suppliers.map(s => `- ${s.id} | ${s.name}`).join("\n");
    }
    quickContext += "\n\nIMPORTANTE: usa estos IDs directamente en tus acciones json-action (no necesitas consultar la BD para hallarlos). Solo consulta si necesitas datos no listados aquí (instalaciones, presupuestos, etc.).";
  } catch {}

  const messages: ChatMessage[] = [
    { role: "assistant", content: AI_SYSTEM_PROMPT },
    { role: "assistant", content: quickContext },
    ...history.slice(-10),
    { role: "user", content: userContent },
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

  // Bucle agéntico: hasta 5 rondas para permitir consultas de lectura + acciones
  let finalText = "";
  let actions: any[] = [];
  let usedQueries = 0;
  const MAX_ROUNDS = 5;
  const MAX_QUERIES = 6;

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

    if (parsed.queries.length === 0 || usedQueries >= MAX_QUERIES) {
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
          JSON.stringify(result, null, 2).slice(0, 8000) +
          `\n\nUsa este resultado para redactar la respuesta final al usuario o para emitir las acciones json-action correspondientes. No menciones el JSON ni el bloque de query. Responde en español de forma concisa.`,
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
        userMessage: parsedFile ? `[Archivo: ${parsedFile.name}] ${message}` : message,
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
    fileName: parsedFile?.name ?? null,
    matchedSummary,
  });
}
