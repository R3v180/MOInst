"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAppStore, type ViewKey } from "@/store/app-store";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Wrench,
  Package,
  Truck,
  FileText,
  ShoppingCart,
  ClipboardList,
  Siren,
  CalendarDays,
  Settings,
  Snowflake,
  Thermometer,
  Sparkles,
  Wrench as WrenchIcon,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const NAV: NavItem[] = [
  { key: "dashboard", label: "Panel", icon: LayoutDashboard, group: "Principal" },
  { key: "agenda", label: "Agenda", icon: CalendarDays, group: "Principal" },

  { key: "clients", label: "Clientes", icon: Users, group: "Comercial" },
  { key: "sale-quotes", label: "Presupuestos venta", icon: FileText, group: "Comercial" },
  { key: "sale-orders", label: "Pedidos de venta", icon: ClipboardList, group: "Comercial" },

  { key: "installations", label: "Instalaciones", icon: Wrench, group: "Operativa" },
  { key: "incidents", label: "Incidencias / garantías", icon: Siren, group: "Operativa" },
  { key: "maintenances", label: "Mantenimientos", icon: WrenchIcon, group: "Operativa" },
  { key: "albaranes", label: "Albaranes", icon: Truck, group: "Operativa" },

  { key: "suppliers", label: "Proveedores", icon: Truck, group: "Compras" },
  { key: "articles", label: "Artículos", icon: Package, group: "Compras" },
  { key: "purchase-quotes", label: "Presupuestos compra", icon: FileText, group: "Compras" },
  { key: "purchase-orders", label: "Pedidos de compra", icon: ShoppingCart, group: "Compras" },

  { key: "settings", label: "Ajustes", icon: Settings, group: "Sistema" },
];

const STORAGE_KEY = "moinst-sidebar-collapsed";
const EMPTY: string[] = [];

// --- localStorage snapshot cache ---
// useSyncExternalStore exige que getSnapshot devuelva la MISMA referencia si
// el valor no ha cambiado. Como JSON.parse crea un array nuevo cada vez,
// cacheamos por la cadena cruda para estabilizar la referencia y evitar
// loops infinitos de re-render.
let cacheRaw: string | null | undefined;
let cacheValue: string[] = EMPTY;

function readCollapsedSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cacheRaw) return cacheValue;
    cacheRaw = raw;
    const parsed = raw ? (JSON.parse(raw) as unknown) : EMPTY;
    cacheValue = Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : EMPTY;
    return cacheValue;
  } catch {
    return EMPTY;
  }
}

const STORAGE_EVENT = "moinst-sidebar-collapsed-changed";

function subscribeCollapsed(notify: () => void) {
  if (typeof window === "undefined") return () => {};
  // `storage` se dispara para escrituras en OTRAS pestañas. Para la propia
  // pestaña emitimos un evento custom tras cada escritura — así
  // useSyncExternalStore re-renderiza sin necesidad de forceRender/setState.
  window.addEventListener("storage", notify);
  window.addEventListener(STORAGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(STORAGE_EVENT, notify);
  };
}

export function SidebarNav() {
  const { view, setView, setSidebarOpen } = useAppStore();
  const { data: session } = useSession();

  // Contadores para badges en la navegación (cache 60s).
  const { data: alerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fetch("/api/alerts").then((r) => (r.ok ? r.json() : null)),
    staleTime: 60_000,
    refetchOnMount: false,
  });
  const lowStock = alerts?.lowStockCount ?? 0;

  // --- Grupos colapsables ---
  // useSyncExternalStore hidrata correctamente: en SSR usa getServerSnapshot
  // (EMPTY) y tras la hidratación cliente cambia al valor real de localStorage
  // en un re-render separado, sin mismatch de hidratación.
  const collapsedGroups = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsedSnapshot,
    () => EMPTY,
  );

  // Escritura a localStorage + dispatch de evento custom para que
  // useSyncExternalStore (suscribíendose a STORAGE_EVENT) re-renderice.
  // No usamos useState/useReducer, así no hay setState-in-effect ni
  // mutación de variables globales durante el render.
  function writeCollapsed(next: string[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      /* noop */
    }
  }

  function toggleGroup(group: string) {
    const next = collapsedGroups.includes(group)
      ? collapsedGroups.filter((g) => g !== group)
      : [...collapsedGroups, group];
    writeCollapsed(next);
  }

  // Auto-expandir el grupo que contiene el item activo (ej. navegación vía
  // búsqueda global que cambia `view` sin pasar por el sidebar). Como
  // writeCollapsed() no llama a setState directamente (solo dispatcha un
  // evento), el lint rule `set-state-in-effect` no se dispara.
  useEffect(() => {
    const activeItem = NAV.find((n) => view === n.key || view.startsWith(n.key));
    if (!activeItem) return;
    if (!collapsedGroups.includes(activeItem.group)) return;
    writeCollapsed(collapsedGroups.filter((g) => g !== activeItem.group));
  }, [view]);

  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border shrink-0">
        <button
          onClick={() => setView("dashboard")}
          className="flex items-center gap-2.5 group"
        >
          <div className="grid grid-cols-2 gap-0.5 p-1.5 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-md group-hover:scale-105 transition-transform">
            <Snowflake className="w-3.5 h-3.5" />
            <Thermometer className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <div className="font-bold text-base leading-none">MOInst</div>
            <div className="text-[10px] text-sidebar-foreground/60 mt-0.5">Gestión instaladores</div>
          </div>
        </button>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav scroll */}
      <nav className="flex-1 overflow-y-auto scroll-thin py-3 px-2">
        {groups.map((group) => {
          const isCollapsed = collapsedGroups.includes(group);
          return (
            <div key={group} className="mb-3">
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? "Expandir" : "Contraer"} grupo ${group}`}
                className="group/header w-full flex items-center gap-1.5 px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring rounded-sm"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 shrink-0 group-hover/header:translate-x-0.5 transition-transform" />
                ) : (
                  <ChevronDown className="w-3 h-3 shrink-0 transition-transform" />
                )}
                <span className="truncate">{group}</span>
              </button>
              {/* Trick grid 0fr/1fr para animar height sin conocer altura fija.
                  overflow-hidden en el hijo hace que min-height: auto → 0 y
                  permita que la fila colapse realmente a 0. */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="space-y-0.5">
                    {NAV.filter((n) => n.group === group).map((item) => {
                      const active =
                        view === item.key || view.startsWith(item.key);
                      const Icon = item.icon;
                      const showLowStockBadge = item.key === "articles" && lowStock > 0;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setView(item.key)}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all text-left",
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm moinst-nav-active"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5",
                          )}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate flex-1">{item.label}</span>
                          {showLowStockBadge && (
                            <span
                              className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-destructive text-destructive-foreground"
                              title={`${lowStock} artículo(s) con stock bajo el mínimo`}
                            >
                              {lowStock}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* AI button */}
      <div className="px-2 pb-2 shrink-0">
        <button
          onClick={() => useAppStore.getState().setAiPanelOpen(true)}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 transition-opacity shadow-md"
        >
          <Sparkles className="w-4 h-4" />
          <span>Asistente IA</span>
        </button>
      </div>

      {/* User — fila completa clickable → ajustes */}
      <div className="border-t border-sidebar-border px-2 py-2 shrink-0">
        <button
          type="button"
          onClick={() => setView("settings")}
          className="group w-full flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Abrir ajustes"
          title="Ajustes"
        >
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-accent-foreground shrink-0 group-hover:bg-sidebar group-hover:text-sidebar-foreground transition-colors">
            {session?.user?.name?.charAt(0) ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{session?.user?.name}</div>
            <div className="text-[10px] text-sidebar-foreground/50 truncate group-hover:text-sidebar-accent-foreground/70 transition-colors">
              {session?.user?.email}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0 text-sidebar-foreground/40 group-hover:text-sidebar-accent-foreground group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>
    </div>
  );
}
