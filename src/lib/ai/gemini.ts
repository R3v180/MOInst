export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

/**
 * Extrae la lista de API keys configuradas para Gemini en orden de prioridad.
 */
export function getGeminiApiKeys(): string[] {
  const raw =
    process.env.NEXT_PUBLIC_GEMINI_API_KEYS ||
    process.env.GOOGLE_API_KEYS ||
    process.env.GOOGLE_API_KEY ||
    "";

  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

// Índice de la clave actual en uso (rotación secuencial)
let currentKeyIndex = 0;

/**
 * Llama a la API de Gemini (Google AI) con rotación automática de claves si recibe 429.
 * Orden de evaluación: izquierda -> derecha.
 */
export async function generateGeminiChat(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  } = {}
): Promise<string> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error(
      "No se encontraron claves de Gemini configuradas en NEXT_PUBLIC_GEMINI_API_KEYS o GOOGLE_API_KEYS."
    );
  }

  const model = options.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // Extraer instrucciones de sistema y mensajes conversacionales
  const systemTexts: string[] = [];
  const conversationTurns: { role: "user" | "model"; text: string }[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemTexts.push(m.content);
    } else if (m.role === "assistant" && systemTexts.length === 0 && conversationTurns.length === 0) {
      // Si el primer mensaje es assistant con rol de prompt del sistema
      systemTexts.push(m.content);
    } else {
      const role = m.role === "assistant" ? "model" : "user";
      // Si el turno anterior tiene el mismo rol, consolidar
      const lastTurn = conversationTurns[conversationTurns.length - 1];
      if (lastTurn && lastTurn.role === role) {
        lastTurn.text += "\n\n" + m.content;
      } else {
        conversationTurns.push({ role, text: m.content });
      }
    }
  }

  // Si no hay turnos de usuario, crear uno básico
  if (conversationTurns.length === 0) {
    conversationTurns.push({ role: "user", text: "Continuar" });
  } else if (conversationTurns[0].role === "model") {
    // Gemini requiere que el primer turno sea de 'user'
    conversationTurns.unshift({ role: "user", text: "Hola" });
  }

  const payload: any = {
    contents: conversationTurns.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxOutputTokens ?? 4096,
    },
  };

  if (systemTexts.length > 0) {
    payload.systemInstruction = {
      parts: [{ text: systemTexts.join("\n\n") }],
    };
  }

  let attempts = 0;
  let lastError: Error | null = null;
  const totalKeys = keys.length;

  while (attempts < totalKeys) {
    const key = keys[currentKeyIndex];
    const keyDisplay = `${key.slice(0, 8)}...${key.slice(-4)}`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        console.warn(
          `[Gemini Rotation] Clave #${currentKeyIndex + 1} (${keyDisplay}) devolvió 429 (Rate Limit). Rotando a la siguiente clave...`
        );
        currentKeyIndex = (currentKeyIndex + 1) % totalKeys;
        attempts++;
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text();
        // Si el error contiene RESOURCE_EXHAUSTED o quota excedida en el body JSON
        if (
          res.status === 403 &&
          (errorText.includes("RESOURCE_EXHAUSTED") || errorText.includes("QUOTA_EXCEEDED"))
        ) {
          console.warn(
            `[Gemini Rotation] Clave #${currentKeyIndex + 1} (${keyDisplay}) cuota agotada. Rotando a la siguiente clave...`
          );
          currentKeyIndex = (currentKeyIndex + 1) % totalKeys;
          attempts++;
          continue;
        }

        throw new Error(`Gemini API error (${res.status} ${res.statusText}): ${errorText}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const text =
        candidate?.content?.parts
          ?.map((p: any) => p.text || "")
          .filter(Boolean)
          .join("\n") || "";

      return text;
    } catch (err: any) {
      lastError = err;
      if (err.message && (err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED"))) {
        console.warn(
          `[Gemini Rotation] Clave #${currentKeyIndex + 1} (${keyDisplay}) agotada (${err.message}). Rotando...`
        );
        currentKeyIndex = (currentKeyIndex + 1) % totalKeys;
        attempts++;
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `Todas las claves de Gemini (${totalKeys}) han alcanzado el límite de tasa (429). Último error: ${lastError?.message}`
  );
}
