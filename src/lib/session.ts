import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "SOCIO" | "ADMIN";
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return {
    id: (session.user as any).id as string,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: (session.user as any).role as "SOCIO" | "ADMIN",
  };
}

/** Garantiza que la request está autenticada. Lanza error si no. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("No autorizado");
  return u;
}

/** Devuelve un secuencial del tipo "PV-2026-0001" a partir del último número existente. */
export async function nextSequential(
  model: "saleQuote" | "saleOrder" | "purchaseOrder" | "incident",
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const last = await (db as any)[model].findMany({
    where: { number: { startsWith: `${prefix}-${year}-` } },
    select: { number: true },
  });
  let max = 0;
  for (const r of last) {
    const parts = String(r.number).split("-");
    const n = parseInt(parts[parts.length - 1] || "0", 10);
    if (n > max) max = n;
  }
  const next = max + 1;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}
