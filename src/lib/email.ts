// Helper de envío de email vía SMTP configurable.
// Lee la configuración desde la tabla Setting (key: "smtp").
// Si no hay SMTP configurado, devuelve { ok: false, reason: "not-configured" }
// y el llamador debe hacer fallback a "compose + copiar".
import { db } from "@/lib/db";
import type { Transporter } from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean; // true para 465, false para 587
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

let cachedTransport: { config: string; transporter: Transporter } | null = null;

/** Lee la config SMTP desde la BD. Devuelve null si no está configurada. */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const row = await db.setting.findUnique({ where: { key: "smtp" } });
  if (!row?.value) return null;
  const v = row.value as any;
  if (!v.host || !v.user || !v.fromEmail) return null;
  return {
    host: v.host,
    port: Number(v.port) || 587,
    secure: !!v.secure,
    user: v.user,
    password: v.password ?? "",
    fromEmail: v.fromEmail,
    fromName: v.fromName ?? "MOInst",
  };
}

/** ¿Hay SMTP configurado y completo? */
export async function isSmtpConfigured(): Promise<boolean> {
  const c = await getSmtpConfig();
  return c !== null && c.password.length > 0;
}

/** Crea (o reutiliza) un transporter de nodemailer. */
async function getTransporter(cfg: SmtpConfig): Promise<Transporter> {
  const cfgKey = JSON.stringify(cfg);
  if (cachedTransport?.config === cfgKey) {
    return cachedTransport.transporter;
  }
  const { createTransport } = await import("nodemailer");
  const transporter = createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
  });
  cachedTransport = { config: cfgKey, transporter };
  return transporter;
}

/** Envía un email. Devuelve { ok, error? }. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getSmtpConfig();
  if (!cfg) return { ok: false, error: "SMTP no configurado" };
  try {
    const transporter = await getTransporter(cfg);
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Error de envío" };
  }
}

/** Verifica la conexión SMTP (para el botón "Probar conexión"). */
export async function testSmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getSmtpConfig();
  if (!cfg) return { ok: false, error: "SMTP no configurado" };
  try {
    const transporter = await getTransporter(cfg);
    await transporter.verify();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "No se pudo conectar" };
  }
}
