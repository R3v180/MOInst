import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const supplierId = sp.get("supplierId") ?? "";
  const saleOrderId = sp.get("saleOrderId") ?? "";
  const status = sp.get("status") ?? "";
  const includeMeta = sp.get("includeMeta") === "1";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)));

  const where: any = { AND: [] };
  if (supplierId) where.AND.push({ supplierId });
  if (saleOrderId) where.AND.push({ saleOrderId });
  if (status) where.AND.push({ status: status as any });
  if (q) {
    where.AND.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { saleOrder: { number: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const [total, items] = await Promise.all([
    db.purchaseOrder.count({ where }),
    db.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        sourcePurchaseQuote: { select: { id: true } },
        saleOrder: {
          select: {
            id: true,
            number: true,
            client: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { name: true } },
        _count: { select: { lines: true, albaranes: true } },
      },
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  let meta: { suppliers: any[]; saleOrders: any[] } | undefined;
  if (includeMeta) {
    const [suppliers, saleOrders] = await Promise.all([
      db.supplier.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, contactName: true },
      }),
      db.saleOrder.findMany({
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          number: true,
          client: { select: { id: true, name: true } },
        },
        take: 100,
      }),
    ]);
    meta = { suppliers, saleOrders };
  }

  return NextResponse.json({ items, total, page, pageSize, meta });
}
