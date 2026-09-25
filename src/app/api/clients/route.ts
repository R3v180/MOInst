import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  nif: z.string().optional().nullable(),
  phonePrimary: z.string().optional().nullable(),
  phoneSecondary: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  addressStreet: z.string().optional().nullable(),
  addressNumber: z.string().optional().nullable(),
  addressFloor: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const city = sp.get("city") ?? "";
  const onlyWithIncidents = sp.get("incidents") === "1";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10)));

  const where: any = {
    AND: [],
  };
  if (q) {
    where.AND.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phonePrimary: { contains: q } },
        { phoneSecondary: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { nif: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (city) where.AND.push({ city: { contains: city, mode: "insensitive" } });
  if (onlyWithIncidents) {
    where.AND.push({ incidents: { some: { status: { in: ["OPEN", "IN_RESOLUTION"] } } } });
  }

  if (where.AND && where.AND.length === 0) delete where.AND;
  const [total, items] = await Promise.all([
    db.client.count({ where }),
    db.client.findMany({
      where,
      include: {
        _count: {
          select: {
            installations: { where: { status: "ACTIVE" } },
            saleOrders: true,
            incidents: { where: { status: { in: ["OPEN", "IN_RESOLUTION"] } } },
          },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const cities = await db.client.findMany({
    where: { city: { not: null } },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    cities: cities.map((c) => c.city).filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const d = parsed.data;
  const client = await db.client.create({
    data: {
      ...d,
      email: d.email ?? null,
      createdById: user.id,
    },
  });
  return NextResponse.json(client, { status: 201 });
}
