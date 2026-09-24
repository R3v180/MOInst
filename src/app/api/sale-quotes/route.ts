import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser, nextSequential } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const lineSchema = z.object({
  articleId: z.string().nullable().optional(),
  description: z.string().min(1, "La descripción de la línea es obligatoria"),
  quantity: z.number().min(0).default(1),
  unitPrice: z.number().min(0).default(0),
  discount: z.number().min(0).max(100).default(0),
  isLabor: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const createSchema = z.object({
  clientId: z.string().min(1, "El cliente es obligatorio"),
  installationId: z.string().nullable().optional(),
  issueDate: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(lineSchema).default([]),
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status") ?? "";
  const clientId = sp.get("clientId") ?? "";
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)));

  const where: any = { AND: [] };
  if (q) where.AND.push({ number: { contains: q, mode: "insensitive" } });
  if (status) where.AND.push({ status: status as any });
  if (clientId) where.AND.push({ clientId });
  if (dateFrom || dateTo) {
    const range: any = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo);
      d.setDate(d.getDate() + 1);
      range.lt = d;
    }
    where.AND.push({ issueDate: range });
  }

  const [total, items] = await Promise.all([
    db.saleQuote.count({ where }),
    db.saleQuote.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, city: true, phonePrimary: true } },
        installation: { select: { id: true, brand: true, model: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const d = parsed.data;

  // Validar que el cliente existe
  const client = await db.client.findUnique({ where: { id: d.clientId } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });

  // Calcular subtotales y totales
  const lines = d.lines.map((l, idx) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const disc = Number(l.discount) || 0;
    const subtotal = round2(qty * price * (1 - disc / 100));
    return {
      ...l,
      articleId: l.articleId ?? null,
      quantity: qty,
      unitPrice: price,
      discount: disc,
      subtotal,
      sortOrder: l.sortOrder ?? idx,
    };
  });
  const laborTotal = round2(lines.filter((l) => l.isLabor).reduce((s, l) => s + l.subtotal, 0));
  const total = round2(lines.reduce((s, l) => s + l.subtotal, 0));

  const number = await nextSequential("saleQuote", "PV");

  const quote = await db.saleQuote.create({
    data: {
      number,
      clientId: d.clientId,
      installationId: d.installationId ?? null,
      issueDate: d.issueDate ? new Date(d.issueDate) : new Date(),
      validUntil: d.validUntil ? new Date(d.validUntil) : null,
      notes: d.notes ?? null,
      laborTotal,
      total,
      createdById: user.id,
      lines: { create: lines },
    },
    include: {
      client: true,
      lines: { include: { article: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(quote, { status: 201 });
}
