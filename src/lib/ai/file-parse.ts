// Parseo de archivos adjuntos para el asistente IA de MOInst.
// Soporta CSV, Excel (.xlsx/.xls) y texto plano. Devuelve una representación
// en texto (tabla markdown o CSV) apta para inyectar en el prompt del LLM.
import * as XLSX from "xlsx";

export interface ParsedFile {
  name: string;
  mimeType: string;
  rows: number;
  /** Representación textual de hasta `maxRows` filas, lista para el prompt. */
  textPreview: string;
  /** Cabeceras detectadas (si procede) para ayudar al modelo a mapear campos. */
  headers: string[];
}

const MAX_ROWS_IN_PROMPT = 40;
const MAX_CELL_LEN = 60;

/** Lee un File (subido al chat) y lo convierte en una vista textual para el LLM. */
export async function parseAttachedFile(file: File): Promise<ParsedFile> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name;
  const mimeType = file.type || "application/octet-stream";
  const lower = name.toLowerCase();

  // Excel
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
    return jsonToParsed(name, mimeType, json);
  }

  // CSV / texto
  const text = buf.toString("utf-8");
  const delimiter = text.includes("\t") ? "\t" : text.includes(";") ? ";" : ",";
  const rows = text.split(/\r?\n/).filter((r) => r.trim().length > 0).map((r) => r.split(delimiter));
  return jsonToParsed(name, mimeType, rows);
}

function jsonToParsed(name: string, mimeType: string, rows: any[][]): ParsedFile {
  const total = rows.length;
  const sample = rows.slice(0, MAX_ROWS_IN_PROMPT);
  const headers = (sample[0] ?? []).map((c) => String(c ?? "").slice(0, MAX_CELL_LEN));
  // Tabla markdown (compacta) para el prompt
  const lines: string[] = [];
  for (const r of sample) {
    const cells = r.map((c) => String(c ?? "").replace(/\|/g, "\\|").slice(0, MAX_CELL_LEN));
    lines.push("| " + cells.join(" | ") + " |");
  }
  return {
    name,
    mimeType,
    rows: total,
    headers,
    textPreview: lines.join("\n"),
  };
}

/** Instrucción contextual para el LLM cuando hay un archivo adjunto. */
export function buildAttachmentInstruction(parsed: ParsedFile, userMessage: string): string {
  return `[ARCHIVO ADJUNTO: ${parsed.name} (${parsed.rows} filas, headers: ${parsed.headers.join(", ")})]

Contenido (primeras ${MAX_ROWS_IN_PROMPT} filas):
${parsed.textPreview}

Mensaje del usuario: ${userMessage}

INSTRUCCIONES PARA EL ARCHIVO:
- Si parece una lista de precios de un proveedor (columnas tipo artículo/referencia/precio/cantidad), propón una acción \`set_article_price\` por cada fila cuyo artículo ya exista (necesitarás consultar la BD para hallar el articleId por nombre o código interno; si no existe, propón \`create_article\` y luego \`set_article_price\`).
- Si el usuario indica el proveedor, usa ese supplierId (consulta proveedores por nombre).
- Propón las acciones en bloques json-action SEPARADOS (una por fila relevante) para que el usuario confirme una a una, o si son muchas, resume y propone las más relevantes (top 5-10).
- Si el archivo no es una lista de precios, descríbelo y pregunta qué hacer.`;
}
