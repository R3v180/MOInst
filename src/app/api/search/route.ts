import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const take = 12;
  const [clients, installations, saleQuotes, saleOrders, incidents] = await Promise.all([
    db.client.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phonePrimary: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] },
      select: { id: true, name: true, city: true, phonePrimary: true },
      take,
    }),
    db.installation.findMany({
      where: { OR: [{ serialNumber: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] },
      select: { id: true, serialNumber: true, brand: true, model: true, equipmentType: true, client: { select: { name: true } } },
      take,
    }),
    db.saleQuote.findMany({
      where: { number: { contains: q, mode: "insensitive" } },
      select: { id: true, number: true, status: true, client: { select: { name: true } } },
      take,
    }),
    db.saleOrder.findMany({
      where: { number: { contains: q, mode: "insensitive" } },
      select: { id: true, number: true, status: true, client: { select: { name: true } } },
      take,
    }),
    db.incident.findMany({
      where: { number: { contains: q, mode: "insensitive" } },
      select: { id: true, number: true, status: true, client: { select: { name: true } } },
      take,
    }),
  ]);

  const results = [
    ...clients.map((c) => ({ type: "client" as const, id: c.id, label: c.name, sub: [c.phonePrimary, c.city].filter(Boolean).join(" · ") })),
    ...installations.map((i) => ({ type: "installation" as const, id: i.id, label: [i.brand, i.model, i.serialNumber].filter(Boolean).join(" ") || i.equipmentType, sub: i.client?.name ?? "" })),
    ...saleQuotes.map((s) => ({ type: "saleQuote" as const, id: s.id, label: s.number, sub: s.client?.name ?? "" })),
    ...saleOrders.map((s) => ({ type: "saleOrder" as const, id: s.id, label: s.number, sub: s.client?.name ?? "" })),
    ...incidents.map((i) => ({ type: "incident" as const, id: i.id, label: i.number, sub: i.client?.name ?? "" })),
  ];

  return NextResponse.json({ results });
}
