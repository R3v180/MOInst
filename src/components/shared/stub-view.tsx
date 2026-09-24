"use client";

import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const TITLES: Record<string, { title: string; desc: string }> = {
  installations: { title: "Instalaciones", desc: "Equipos instalados en casa de clientes" },
  "installation-detail": { title: "Instalación", desc: "Ficha del equipo" },
  articles: { title: "Artículos", desc: "Catálogo de materiales" },
  "article-detail": { title: "Artículo", desc: "Ficha del artículo" },
  suppliers: { title: "Proveedores", desc: "Gestión de proveedores" },
  "supplier-detail": { title: "Proveedor", desc: "Ficha del proveedor" },
  "sale-quotes": { title: "Presupuestos de venta", desc: "Presupuestos a clientes" },
  "sale-quote-detail": { title: "Presupuesto de venta", desc: "Detalle del presupuesto" },
  "sale-orders": { title: "Pedidos de venta", desc: "Pedidos de clientes" },
  "sale-order-detail": { title: "Pedido de venta", desc: "Detalle del pedido" },
  "purchase-quotes": { title: "Presupuestos de compra", desc: "Presupuestos de proveedores" },
  "purchase-quote-detail": { title: "Presupuesto de compra", desc: "Detalle del presupuesto de compra" },
  "purchase-orders": { title: "Pedidos de compra", desc: "Pedidos a proveedores" },
  "purchase-order-detail": { title: "Pedido de compra", desc: "Detalle del pedido de compra" },
  albaranes: { title: "Albaranes", desc: "Entradas y entregas" },
  incidents: { title: "Incidencias / Garantías", desc: "Averías y reclamaciones de garantía" },
  "incident-detail": { title: "Incidencia", desc: "Detalle de la incidencia" },
  agenda: { title: "Agenda", desc: "Citas y visitas" },
  settings: { title: "Ajustes", desc: "Configuración de la aplicación" },
};

export function StubView({ view }: { view: string }) {
  const t = TITLES[view] ?? { title: view, desc: "" };
  return (
    <div>
      <PageHeader title={t.title} description={t.desc} />
      <EmptyState
        icon={<Sparkles className="w-6 h-6" />}
        title="Módulo en desarrollo"
        description="Este módulo se está construyendo. Mientras tanto, puedes usar el asistente IA para consultar o crear datos de este módulo."
        action={
          <Button onClick={() => useAppStore.getState().setAiPanelOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" /> Preguntar a la IA
          </Button>
        }
      />
    </div>
  );
}
