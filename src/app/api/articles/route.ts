import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  internalCode: z.string().min(1, "Código interno obligatorio"),
  name: z.string().min(1, "Nombre obligatorio"),
  category: z.string().min(1, "Categoría obligatoria"),
  articleType: z.enum(["SERIALIZED", "CONSUMABLE"]),
  unit: z.string().optional().default("unidad"),
  brand: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  stock: z.number().optional().default(0),
  stockMin: z.number().optional().default(0),
});

// Categorías disponibles (configuradas en Setting.articleCategories)
async function getCategories(): Promise<string[]> {
  const row = await db.setting.findUnique({ where: { key: "articleCategories" } });
  const v = (row?.value as string[] | null) ?? null;
  if (Array.isArray(v)) return v as string[];
  return [];
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const category = sp.get("category") ?? "";
  const articleType = sp.get("articleType") ?? "";
  const onlyLowStock = sp.get("lowStock") === "1";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)));

  const where: any = { AND: [] };
  if (q) {
    where.AND.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { internalCode: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (category) where.AND.push({ category: { equals: category } });
  if (articleType === "SERIALIZED" || articleType === "CONSUMABLE") {
    where.AND.push({ articleType });
  }
  if (onlyLowStock) {
    where.AND.push({ stock: { lte: db.article.fields.stockMin } });
  }

  const [total, items] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Mejor precio actual: mínimo entre los últimos precios por proveedor de cada artículo.
  // Obtenemos latest-per-supplier con SQL y agregamos en JS.
  let bestPrices: Record<
    string,
    { price: number; supplierId: string; supplierName: string; priceDate: string } | null
  > = {};
  if (items.length > 0) {
    const ids = items.map((a) => a.id);
    const rows: any[] = await db.$queryRaw`
      WITH latest AS (
        SELECT DISTINCT ON ("articleId", "supplierId")
          "articleId", "supplierId", "price", "priceDate"
        FROM "ArticleSupplier"
        WHERE "articleId" = ANY(${ids}::text[])
        ORDER BY "articleId", "supplierId", "priceDate" DESC
      )
      SELECT l."articleId", l."supplierId", l."price", l."priceDate",
             s."name" AS "supplierName"
      FROM latest l
      LEFT JOIN "Supplier" s ON s.id = l."supplierId"
    `;
    for (const r of rows) {
      const artId = r.articleId as string;
      const price = Number(r.price);
      const cur = bestPrices[artId];
      if (!cur || price < cur.price) {
        bestPrices[artId] = {
          price,
          supplierId: r.supplierId as string,
          supplierName: (r.supplierName as string) ?? "",
          priceDate: r.priceDate as unknown as string,
        };
      }
    }
  }

  const categories = await getCategories();

  return NextResponse.json({
    items: items.map((a) => ({
      ...a,
      bestPrice: bestPrices[a.id] ?? null,
    })),
    total,
    page,
    pageSize,
    categories,
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
  // Validar que internalCode no exista
  const exists = await db.article.findUnique({
    where: { internalCode: d.internalCode },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json(
      { error: `Ya existe un artículo con código "${d.internalCode}"` },
      { status: 400 }
    );
  }
  const article = await db.article.create({
    data: {
      internalCode: d.internalCode,
      name: d.name,
      category: d.category,
      articleType: d.articleType,
      unit: d.unit ?? "unidad",
      brand: d.brand ?? null,
      description: d.description ?? null,
      stock: d.stock ?? 0,
      stockMin: d.stockMin ?? 0,
    },
  });
  return NextResponse.json(article, { status: 201 });
}
