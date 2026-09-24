import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status") ?? "";
  const clientId = sp.get("clientId") ?? "";
  const paymentStatus = sp.get("paymentStatus") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)));

  const where: any = { AND: [] };
  if (q) where.AND.push({ number: { contains: q, mode: "insensitive" } });
  if (status) where.AND.push({ status: status as any });
  if (clientId) where.AND.push({ clientId });
  if (paymentStatus) where.AND.push({ paymentStatus: paymentStatus as any });

  if (where.AND && where.AND.length === 0) delete where.AND;
  const [total, items] = await Promise.all([
    db.saleOrder.count({ where }),
    db.saleOrder.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, city: true, phonePrimary: true } },
        sourceSaleQuote: { select: { id: true, number: true } },
        createdBy: { select: { name: true } },
        _count: {
          select: {
            installations: true,
            incidents: { where: { status: { in: ["OPEN", "IN_RESOLUTION"] } } },
            deliveryAlbaranes: true,
          },
        },
      },
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}
