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
  /** Filas crudas (2D array) para matching estructurado posterior. */
  rawRows: string[][];
}

/** Fila estructurada extraída de una lista de precios (para matching en BD). */
export interface PriceListRow {
  rowIndex: number;
  name?: string;
  reference?: string;
  price?: number;
  quantity?: number;
  raw: string[];
}

const MAX_ROWS_IN_PROMPT = 40;
const MAX_CELL_LEN = 60;

const NAME_KEYS = ["articulo", "artículo", "nombre", "name", "description", "descripción", "producto", "concepto", "descripcion"];
const REF_KEYS = ["referencia", "ref", "codigo", "código", "code", "sku", "refprov", "ref prov"];
const PRICE_KEYS = ["precio", "price", "importe", "coste", "cost", "pvp", "tarifa"];
const QTY_KEYS = ["cantidad", "qty", "quantity", "unidades", "uds"];

/** Lee un File (subido al chat) y lo convierte en una vista textual para el LLM. */
export async function parseAttachedFile(file: File): Promise<ParsedFile> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name;
  const mimeType = file.type || "application/octet-stream";
  const lower = name.toLowerCase();

  let rawRows: string[][] = [];

  // Excel
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
    rawRows = json.map((r) => r.map((c) => String(c ?? "")));
  } else {
    // CSV / texto
    const text = buf.toString("utf-8");
    const delimiter = text.includes("\t") ? "\t" : text.includes(";") ? ";" : ",";
    rawRows = text.split(/\r?\n/).filter((r) => r.trim().length > 0).map((r) => r.split(delimiter));
  }

  return jsonToParsed(name, mimeType, rawRows);
}

function jsonToParsed(name: string, mimeType: string, rows: string[][]): ParsedFile {
  const total = rows.length;
  const sample = rows.slice(0, MAX_ROWS_IN_PROMPT);
  const headers = (sample[0] ?? []).map((c) => String(c ?? "").slice(0, MAX_CELL_LEN));
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
    rawRows: rows,
  };
}

/** Detecta si el archivo parseado parece una lista de precios. */
export function looksLikePriceList(parsed: ParsedFile): boolean {
  const headerStr = parsed.headers.join(" ").toLowerCase();
  const hasName = NAME_KEYS.some((k) => headerStr.includes(k));
  const hasPrice = PRICE_KEYS.some((k) => headerStr.includes(k));
  return hasName && hasPrice;
}

/**
 * Extrae filas estructuradas (name/reference/price) de un ParsedFile
 * asumiendo que la primera fila es la cabecera.
 */
export function extractPriceListRows(parsed: ParsedFile): PriceListRow[] {
  if (parsed.rawRows.length < 2) return [];
  const headers = parsed.rawRows[0].map((h) => h.toLowerCase().trim());
  const findCol = (keys: string[]) => {
    for (let i = 0; i < headers.length; i++) {
      if (keys.some((k) => headers[i] === k || headers[i].includes(k))) return i;
    }
    return -1;
  };
  const nameCol = findCol(NAME_KEYS);
  const refCol = findCol(REF_KEYS);
  const priceCol = findCol(PRICE_KEYS);
  const qtyCol = findCol(QTY_KEYS);
  if (nameCol < 0 && refCol < 0) return [];

  const out: PriceListRow[] = [];
  for (let i = 1; i < parsed.rawRows.length; i++) {
    const r = parsed.rawRows[i];
    if (!r || r.every((c) => !c.trim())) continue;
    const priceRaw = priceCol >= 0 ? r[priceCol] : undefined;
    const price = priceRaw ? parseFloat(String(priceRaw).replace(/[^\d,.-]/g, "").replace(",", ".")) : undefined;
    out.push({
      rowIndex: i,
      name: nameCol >= 0 ? r[nameCol]?.trim() || undefined : undefined,
      reference: refCol >= 0 ? r[refCol]?.trim() || undefined : undefined,
      price: !isNaN(price ?? NaN) ? price : undefined,
      quantity: qtyCol >= 0 ? parseInt(r[qtyCol], 10) || undefined : undefined,
      raw: r,
    });
  }
  return out;
}

/** Instrucción contextual para el LLM cuando hay un archivo adjunto (sin matching previo). */
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

/**
 * Instrucción enriquecida CON matching previo de artículos en la BD.
 * El LLM recibe articleIds concretos y solo tiene que emitir las acciones.
 */
export function buildMatchedPriceListInstruction(
  parsed: ParsedFile,
  userMessage: string,
  matched: Array<{
    input: PriceListRow;
    article?: { id: string; name: string; internalCode: string };
    supplier?: { id: string; name: string };
  }>,
  supplierHint?: { id: string; name: string } | null
): string {
  const supplierInfo = supplierHint
    ? `Proveedor indicado: ${supplierHint.name} (supplierId=${supplierHint.id})`
    : "Proveedor NO especificado — pregunta al usuario o usa el más barato conocido.";

  const lines: string[] = [];
  lines.push(`[ARCHIVO ADJUNTO: ${parsed.name} — LISTA DE PRECIOS (${matched.length} filas procesadas)]`);
  lines.push(supplierInfo);
  lines.push("");
  lines.push("FILAS PROCESADAS CON MATCHING EN BD:");
  lines.push("");

  for (const m of matched) {
    const p = m.input;
    const articlePart = m.article
      ? `✓ artículo EXISTE → articleId=${m.article.id} (${m.article.name}, código ${m.article.internalCode})`
      : `✗ artículo NO encontrado — propón create_article con nombre "${p.name}"`;
    lines.push(`- Fila ${p.rowIndex}: nombre="${p.name || "—"}" ref="${p.reference || "—"}" precio=${p.price ?? "—"} → ${articlePart}`);
  }

  lines.push("");
  lines.push(`Mensaje del usuario: ${userMessage}`);
  lines.push("");
  lines.push("INSTRUCCIONES:");
  lines.push("- Para cada fila con artículo EXISTENTE y precio definido, emite un bloque json-action `set_article_price` con { articleId, supplierId, price, supplierRef }.");
  if (supplierHint) {
    lines.push(`  Usa supplierId="${supplierHint.id}" para todas las acciones.`);
  }
  lines.push("- Para filas SIN artículo, si el usuario quiere darlos de alta, emite `create_article` y luego `set_article_price`.");
  lines.push("- Emite TODAS las acciones json-action que correspondan (una por fila). El usuario confirmará una a una.");
  lines.push("- NO muestres el JSON crudo al usuario; redacta un resumen breve de qué vas a proponer.");

  return lines.join("\n");
}
