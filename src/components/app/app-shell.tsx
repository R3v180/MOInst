"use client";

import { useAppStore } from "@/store/app-store";
import { TopBar } from "@/components/app/topbar";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { AiChatPanel } from "@/components/app/ai-chat-panel";
import { DashboardView } from "@/components/views/dashboard-view";
import { ClientsView } from "@/components/views/clients-view";
import { ClientDetailView } from "@/components/views/client-detail-view";
import { InstallationsView } from "@/components/views/installations-view";
import { InstallationDetailView } from "@/components/views/installation-detail-view";
import { ArticlesView } from "@/components/views/articles-view";
import { ArticleDetailView } from "@/components/views/article-detail-view";
import { SuppliersView } from "@/components/views/suppliers-view";
import { SupplierDetailView } from "@/components/views/supplier-detail-view";
import { SaleQuotesView } from "@/components/views/sale-quotes-view";
import { SaleQuoteDetailView } from "@/components/views/sale-quote-detail-view";
import { SaleOrdersView } from "@/components/views/sale-orders-view";
import { SaleOrderDetailView } from "@/components/views/sale-order-detail-view";
import { PurchaseQuotesView } from "@/components/views/purchase-quotes-view";
import { PurchaseQuoteDetailView } from "@/components/views/purchase-quote-detail-view";
import { PurchaseOrdersView } from "@/components/views/purchase-orders-view";
import { PurchaseOrderDetailView } from "@/components/views/purchase-order-detail-view";
import { AlbaranesView } from "@/components/views/albaranes-view";
import { IncidentsView } from "@/components/views/incidents-view";
import { IncidentDetailView } from "@/components/views/incident-detail-view";
import { AgendaView } from "@/components/views/agenda-view";
import { SettingsView } from "@/components/views/settings-view";
import { ErrorBoundary } from "@/components/shared/error-boundary";

export function AppShell() {
  const { view } = useAppStore();

  const renderView = () => {
    switch (view) {
      case "dashboard": return <DashboardView />;
      case "clients": return <ClientsView />;
      case "client-detail": return <ClientDetailView />;
      case "installations": return <InstallationsView />;
      case "installation-detail": return <InstallationDetailView />;
      case "articles": return <ArticlesView />;
      case "article-detail": return <ArticleDetailView />;
      case "suppliers": return <SuppliersView />;
      case "supplier-detail": return <SupplierDetailView />;
      case "sale-quotes": return <SaleQuotesView />;
      case "sale-quote-detail": return <SaleQuoteDetailView />;
      case "sale-orders": return <SaleOrdersView />;
      case "sale-order-detail": return <SaleOrderDetailView />;
      case "purchase-quotes": return <PurchaseQuotesView />;
      case "purchase-quote-detail": return <PurchaseQuoteDetailView />;
      case "purchase-orders": return <PurchaseOrdersView />;
      case "purchase-order-detail": return <PurchaseOrderDetailView />;
      case "albaranes": return <AlbaranesView />;
      case "incidents": return <IncidentsView />;
      case "incident-detail": return <IncidentDetailView />;
      case "agenda": return <AgendaView />;
      case "settings": return <SettingsView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Sidebar fijo en escritorio */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-40">
        <SidebarNav />
      </aside>

      {/* Contenido principal */}
      <div className="lg:pl-64 flex-1 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          <ErrorBoundary key={view}>
            {renderView()}
          </ErrorBoundary>
        </main>
        <footer className="mt-auto border-t border-border bg-background py-3 px-4 text-center text-xs text-muted-foreground">
          MOInst · Aplicación interna de gestión para instaladores · {new Date().getFullYear()}
        </footer>
      </div>

      {/* Panel IA flotante */}
      <AiChatPanel />
    </div>
  );
}
