import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Nombre obligatorio"),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)));

  const where: any = { AND: [] };
  if (q) {
    where.AND.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (where.AND && where.AND.length === 0) delete where.AND;
  const [total, items] = await Promise.all([
    db.supplier.count({ where }),
    db.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { articlePrices: true } },
      },
    }),
  ]);

  // Contar artículos distintos (un proveedor puede tener N filas ArticleSupplier por artículo)
  const ids = items.map((s) => s.id);
  let articlesCount: Record<string, number> = {};
  if (ids.length > 0) {
    const rows: any[] = await db.$queryRaw`
      SELECT "supplierId", COUNT(DISTINCT "articleId")::int AS n
      FROM "ArticleSupplier"
      WHERE "supplierId" = ANY(${ids}::text[])
      GROUP BY "supplierId"
    `;
    for (const r of rows) {
      articlesCount[r.supplierId as string] = Number(r.n);
    }
  }

  return NextResponse.json({
    items: items.map((s) => ({
      ...s,
      articlesCount: articlesCount[s.id] ?? 0,
    })),
    total,
    page,
    pageSize,
  });
}

export async function POST(req: NextRequest) {
  await requireUser();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const supplier = await db.supplier.create({
    data: {
      name: d.name,
      phone: d.phone ?? null,
      email: d.email ?? null,
      address: d.address ?? null,
      contactName: d.contactName ?? null,
      notes: d.notes ?? null,
    },
  });
  return NextResponse.json(supplier, { status: 201 });
}
