import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Sembrando datos iniciales en MOInst...");

  const pw = await bcrypt.hash("moinst123", 10);

  // 2 socios
  await db.user.upsert({
    where: { email: "socio1@moinst.local" },
    update: { passwordHash: pw },
    create: {
      name: "Socio 1",
      email: "socio1@moinst.local",
      phone: "+34 600 000 001",
      role: "SOCIO",
      passwordHash: pw,
      active: true,
    },
  });
  await db.user.upsert({
    where: { email: "socio2@moinst.local" },
    update: { passwordHash: pw },
    create: {
      name: "Socio 2",
      email: "socio2@moinst.local",
      phone: "+34 600 000 002",
      role: "SOCIO",
      passwordHash: pw,
      active: true,
    },
  });
  console.log("✓ 2 socios creados (login: socio1/socio2@moinst.local · pw: moinst123)");

  // Ajustes por defecto
  const defaults: Record<string, any> = {
    articleCategories: ["climatización", "calderas", "termos", "repuestos", "accesorios", "consumibles"],
    installationTypes: ["aire acondicionado", "caldera", "termo", "otro"],
    defaultWarrantyMonths: 24,
    emailTemplateQuote: `Estimado/a {clienteName},

Adjunto el presupuesto solicitado (nº {quoteNumber}) con un total de {total}.

El presupuesto tiene una validez de 30 días. Si tiene cualquier duda o desea modificar algún punto, no dude en contactarnos.

Quedamos a su disposición.
Saludos cordiales,
{companyName}`,
    emailTemplateWarranty: `Estimado/a {clienteName},

Le recordamos que la garantía de su instalación ({equipmentType} {brandModel}) finaliza el {warrantyEndDate}.

Si desea revisar el equipo o ampliar la garantía, contáctenos lo antes posible.

Saludos cordiales,
{companyName}`,
    emailTemplateAppointment: `Estimado/a {clienteName},

Le confirmamos la cita para el {appointmentDate} en {address}.

Saludos cordiales,
{companyName}`,
    companyName: "MOInst",
    lowStockAlerts: true,
  };

  for (const [key, value] of Object.entries(defaults)) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as any },
    });
  }
  console.log("✓ Ajustes por defecto creados");

  console.log("🌱 Seed completado.");
}

seed()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
