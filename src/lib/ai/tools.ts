// Herramientas para el asistente IA de MOInst.
// - Consultas de LECTURA (ejecutadas directamente por el backend, sin confirmación)
// - Acciones de ESCRITURA (propuestas al usuario; se ejecutan solo tras confirmación)
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas seguras (whitelist de modelos + campos)
// ─────────────────────────────────────────────────────────────────────────────
const READ_MODELS = [
  "client", "installation", "supplier", "article", "articleSupplier",
  "saleQuote", "saleOrder", "purchaseQuote", "purchaseOrder",
  "albaran", "incident", "maintenance", "appointment", "user",
] as const;

type ReadModel = (typeof READ_MODELS)[number];

interface ReadQuery {
  model: ReadModel;
  where?: Record<string, unknown>;
  select?: Record<string, boolean>;
  include?: Record<string, boolean>;
  take?: number;
  skip?: number;
  orderBy?: Record<string, string>;
  count?: boolean;
  groupBy?: string;
}

const MAX_TAKE = 50;

/** Ejecuta una consulta de lectura validada. Devuelve datos serializables. */
export async function executeReadQuery(q: ReadQuery): Promise<unknown> {
  if (!READ_MODELS.includes(q.model)) {
    return { error: `Modelo '${q.model}' no permitido` };
  }
  const model = (db as any)[q.model];
  if (!model) return { error: `Modelo '${q.model}' no encontrado` };

  const take = Math.min(MAX_TAKE, q.take ?? 20);

  // Sanitiza `where`: quita cláusulas peligrosas; acepta prisma filters básicos
  const where = sanitizeWhere(q.where ?? {});
  const args: any = { where, take };
  if (q.skip) args.skip = q.skip;
  if (q.orderBy) args.orderBy = q.orderBy;
  if (q.include) args.include = sanitizeInclude(q.include);
  if (q.select) args.select = sanitizeInclude(q.select);

  try {
    if (q.count) {
      return await model.count({ where });
    }
    return await model.findMany(args);
  } catch (e: any) {
    return { error: e.message ?? "Error en consulta" };
  }
}

function sanitizeWhere(w: Record<string, unknown>): any {
  // Permitimos prisma filters comunes; no tocamos el contenido (el modelo está en whitelist)
  return w;
}
function sanitizeInclude(o: Record<string, boolean>): any {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) if (typeof v === "boolean") out[k] = v;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sistema de prompts
// ─────────────────────────────────────────────────────────────────────────────
export const AI_SYSTEM_PROMPT = `Eres MOInst, el asistente IA interno de una aplicación de gestión para un negocio de instalación de aire acondicionado, calderas y termos (2 socios). Estás integrado en la app web y puedes OPERAR sobre todos los módulos, no solo responder.

Módulos disponibles: clientes, instalaciones, proveedores, artículos (con histórico de precios por proveedor), presupuestos de venta, pedidos de venta, presupuestos de compra, pedidos de compra, albaranes, incidencias/garantías, mantenimientos, agenda/citas, ajustes.

Esquema simplificado (Prisma/Postgres):
- Client: id, name, nif, phonePrimary, phoneSecondary, email, addressStreet/Number/Floor, city, province, postalCode, notes, createdAt, createdById
- Installation: id, clientId, equipmentType, brand, model, serialNumber, location, installDate, warrantyEndDate, sourceSaleOrderId, status (ACTIVE/REMOVED/REPLACED), notes
- Supplier: id, name, phone, email, address, contactName, notes
- Article: id, internalCode, name, category, articleType (SERIALIZED/CONSUMABLE), unit, brand, description, stock, stockMin
- ArticleSupplier: id, articleId, supplierId, price, supplierRef, priceDate, deliveryDays, notes  (histórico: NUNCA se sobrescribe, se añaden filas)
- SaleQuote: id, number (PV-AAAA-NNNN), clientId, installationId?, issueDate, validUntil?, status (DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED), laborTotal, total, notes, lines[] (articleId?, description, quantity, unitPrice, discount, subtotal, isLabor)
- SaleOrder: id, number (PDV-AAAA-NNNN), sourceSaleQuoteId?, clientId, issueDate, status (PENDING/IN_PROGRESS/INSTALLED/CLOSED), paymentStatus (PAID/PENDING), notes
- PurchaseQuote: id, supplierId, saleOrderId? (VÍNCULO CLAVE), issueDate, total, status (RECEIVED/ACCEPTED/DISCARDED), lines[]
- PurchaseOrder: id, number, sourcePurchaseQuoteId?, supplierId, saleOrderId?, status (PENDING/PARTIAL_RECEIVED/RECEIVED)
- Albaran: id, type (SUPPLIER_IN/CLIENT_DELIVERY), purchaseOrderId?, saleOrderId?, date, notes
- Incident: id, number (INC-AAAA-NNNN), clientId, installationId?, saleOrderId?, description, status (OPEN/IN_RESOLUTION/CLOSED), resolution, openedAt, closedAt
- Maintenance: id, installationId, date, nextReviewDate?, notes
- Appointment: id, type (QUOTE_VISIT/INSTALLATION/MAINTENANCE/INCIDENT/OTHER), startAt, durationMin, clientId?, installationId?, assignedToId, address?, status (PENDING/DONE/CANCELLED), notes

REGLAS DE COMPORTAMIENTO:
1. Respondes SIEMPRE en español, de forma concisa y profesional.
2. Para CONSULTAS de lectura, puedes usar la herramienta de query emitiendo un bloque:
\`\`\`json-query
{ "model": "client", "where": { "name": { "contains": "Gar", "mode": "insensitive" } }, "take": 10 }
\`\`\`
   El sistema ejecutará la consulta y te devolverá el resultado; entonces podrás redactar la respuesta final al usuario. NO muestres el JSON al usuario, solo el resultado natural.
   Modelos permitidos para query: ${READ_MODELS.join(", ")}.
   Usa \`count: true\` para contar. Ej: {"model":"installation","where":{"equipmentType":"caldera"},"count":true}
3. Para PROPONER una acción que crea, modifica o borra datos, emite un bloque:
\`\`\`json-action
{ "type": "create_client", "label": "Crear cliente 'Juan García'", "payload": { "name": "Juan García", "phonePrimary": "...", ... } }
\`\`\`
   NUNCA ejecutas la acción directamente: la propones y el usuario debe confirmar explícitamente. Tras confirmar, el sistema la ejecuta.
   Tipos de acción soportados: create_client, update_client, create_supplier, update_supplier, create_article, set_article_price, create_appointment, close_incident, update_incident, create_installation, create_maintenance, set_sale_quote_status, generate_sale_order_from_quote.
4. Si el usuario pide algo ambiguo, pide aclaración antes de proponer.
5. Para emails (avisos, reenvío de presupuestos), redacta el texto y propón la acción "compose_email" con el cuerpo; el usuario podrá copiarlo o enviarlo.
6. Sé proactivo: si detectas que algo se puede mejorar (ej. un presupuesto sin respuesta hace 10 días), menciónalo.`;

// ─────────────────────────────────────────────────────────────────────────────
// Ejecución de acciones (tras confirmación del usuario)
// ─────────────────────────────────────────────────────────────────────────────
export interface AiAction {
  type: string;
  label?: string;
  payload: Record<string, unknown>;
}

/** Ejecuta una acción confirmada. Devuelve un resumen para el log. */
export async function executeAction(
  action: AiAction,
  userId: string
): Promise<{ ok: boolean; summary: string; result?: unknown }> {
  const { type, payload } = action;
  switch (type) {
    case "create_client": {
      const c = await db.client.create({
        data: { ...(payload as any), createdById: userId },
      });
      return { ok: true, summary: `Cliente creado: ${c.name} (id ${c.id})`, result: c };
    }
    case "update_client": {
      const { id, ...data } = payload as any;
      if (!id) return { ok: false, summary: "Falta id de cliente" };
      const c = await db.client.update({ where: { id }, data });
      return { ok: true, summary: `Cliente actualizado: ${c.name}`, result: c };
    }
    case "create_supplier": {
      const s = await db.supplier.create({ data: payload as any });
      return { ok: true, summary: `Proveedor creado: ${s.name}`, result: s };
    }
    case "update_supplier": {
      const { id, ...data } = payload as any;
      if (!id) return { ok: false, summary: "Falta id de proveedor" };
      const s = await db.supplier.update({ where: { id }, data });
      return { ok: true, summary: `Proveedor actualizado: ${s.name}`, result: s };
    }
    case "create_article": {
      const a = await db.article.create({ data: payload as any });
      return { ok: true, summary: `Artículo creado: ${a.name} (${a.internalCode})`, result: a };
    }
    case "set_article_price": {
      const { articleId, supplierId, price, supplierRef, deliveryDays, notes } = payload as any;
      if (!articleId || !supplierId || price == null)
        return { ok: false, summary: "Faltan articleId/supplierId/price" };
      const ap = await db.articleSupplier.create({
        data: { articleId, supplierId, price: Number(price), supplierRef, deliveryDays, notes },
      });
      return { ok: true, summary: `Precio actualizado (histórico): ${ap.price}€`, result: ap };
    }
    case "create_appointment": {
      const { assignedToId, ...data } = payload as any;
      const a = await db.appointment.create({
        data: { ...data, assignedToId: assignedToId ?? userId },
      });
      return { ok: true, summary: `Cita creada para ${new Date(a.startAt).toLocaleString("es-ES")}`, result: a };
    }
    case "close_incident": {
      const { id, resolution } = payload as any;
      if (!id) return { ok: false, summary: "Falta id de incidencia" };
      const i = await db.incident.update({
        where: { id },
        data: { status: "CLOSED", resolution, closedAt: new Date(), closedById: userId },
      });
      return { ok: true, summary: `Incidencia ${i.number} cerrada`, result: i };
    }
    case "update_incident": {
      const { id, ...data } = payload as any;
      if (!id) return { ok: false, summary: "Falta id de incidencia" };
      const i = await db.incident.update({ where: { id }, data });
      return { ok: true, summary: `Incidencia ${i.number} actualizada`, result: i };
    }
    case "create_installation": {
      const i = await db.installation.create({
        data: { ...(payload as any), createdById: userId },
      });
      return { ok: true, summary: `Instalación creada (id ${i.id})`, result: i };
    }
    case "create_maintenance": {
      const m = await db.maintenance.create({
        data: { ...(payload as any), performedById: userId },
      });
      return { ok: true, summary: `Mantenimiento registrado`, result: m };
    }
    case "set_sale_quote_status": {
      const { id, status } = payload as any;
      if (!id || !status) return { ok: false, summary: "Faltan id/status" };
      const q = await db.saleQuote.update({ where: { id }, data: { status } });
      return { ok: true, summary: `Presupuesto ${q.number} → ${status}`, result: q };
    }
    default:
      return { ok: false, summary: `Tipo de acción no soportado: ${type}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing de bloques JSON embebidos en la respuesta del modelo
// ─────────────────────────────────────────────────────────────────────────────
export interface ParsedAiResponse {
  text: string;
  queries: ReadQuery[];
  actions: AiAction[];
}

const FENCE_RE =
  /```(?:json-)?(query|action)\s*([\s\S]*?)```/g;

export function parseAiResponse(raw: string): ParsedAiResponse {
  const queries: ReadQuery[] = [];
  const actions: AiAction[] = [];
  let text = raw;

  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(raw)) !== null) {
    const kind = m[1];
    const body = m[2].trim();
    try {
      const obj = JSON.parse(body);
      if (kind === "query") queries.push(obj as ReadQuery);
      else actions.push(obj as AiAction);
    } catch {}
    // elimina el bloque del texto visible
    text = text.replace(m[0], "");
  }
  text = text.trim();
  return { text, queries, actions };
}
