"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore, type ViewKey } from "@/store/app-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { NotificationsBell } from "@/components/app/notifications-bell";
import { RecentlyViewed } from "@/components/app/recently-viewed";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Search,
  Menu,
  Snowflake,
  Thermometer,
  LogOut,
  Sparkles,
  X,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

interface SearchResult {
  type: "client" | "installation" | "saleQuote" | "saleOrder" | "incident";
  id: string;
  label: string;
  sub: string;
}

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  client: "Cliente",
  installation: "Instalación",
  saleQuote: "P. venta",
  saleOrder: "Pedido venta",
  incident: "Incidencia",
};

function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    // Stable placeholder (avoids hydration mismatch: server has no theme info)
    return (
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:flex"
        disabled
        aria-hidden
        tabIndex={-1}
      >
        <Sun className="w-5 h-5" />
      </Button>
    );
  }

  // resolvedTheme accounts for "system" (use it for the icon); theme is the user's stored pref.
  const isDark = (resolvedTheme ?? theme) === "dark";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Cambiar tema</TooltipContent>
    </Tooltip>
  );
}

export function TopBar() {
  const { setView, setSidebarOpen, setAiPanelOpen } = useAppStore();
  const { data: session } = useSession();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl + J → abrir panel IA
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAiPanelOpen(true);
      }
      // Cmd/Ctrl + K → enfocar buscador global
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = boxRef.current?.querySelector("input");
        input?.focus();
        input?.select();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [setAiPanelOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const data = await r.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  function openResult(r: SearchResult) {
    setShowResults(false);
    setQ("");
    const map: Record<SearchResult["type"], ViewKey> = {
      client: "client-detail",
      installation: "installation-detail",
      saleQuote: "sale-quote-detail",
      saleOrder: "sale-order-detail",
      incident: "incident-detail",
    };
    setView(map[r.type], { id: r.id });
  }

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="h-full flex items-center gap-2 px-3 sm:px-4">
        {/* Mobile menu */}
        <Sheet open={useAppStore.getState().sidebarOpen} onOpenChange={useAppStore.getState().setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => useAppStore.getState().setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SidebarNav />
          </SheetContent>
        </Sheet>

        {/* Mobile logo */}
        <button
          onClick={() => setView("dashboard")}
          className="lg:hidden flex items-center gap-2"
        >
          <div className="grid grid-cols-2 gap-0.5 p-1 rounded-md bg-primary text-primary-foreground">
            <Snowflake className="w-3 h-3" />
            <Thermometer className="w-3 h-3" />
          </div>
          <span className="font-bold">MOInst</span>
        </button>

        {/* Search */}
        <div ref={boxRef} className="relative flex-1 max-w-xl mx-auto hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q.length >= 2 && setShowResults(true)}
            placeholder="Buscar cliente, instalación, presupuesto, pedido, incidencia..."
            className="pl-9 pr-16"
          />
          {!q && (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded">
              ⌘K
            </kbd>
          )}
          {q && (
            <button
              onClick={() => { setQ(""); setResults([]); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {showResults && q.trim().length >= 2 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-lg max-h-96 overflow-y-auto scroll-thin z-50">
              {loading ? (
                <div className="p-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
                </div>
              ) : results.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  Sin resultados para &quot;{q}&quot;
                </div>
              ) : (
                <ul className="py-1">
                  {results.map((r) => (
                    <li key={`${r.type}-${r.id}`}>
                      <button
                        onClick={() => openResult(r)}
                        className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-3"
                      >
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 w-20 text-center">
                          {TYPE_LABEL[r.type]}
                        </span>
                        <span className="text-sm font-medium truncate">{r.label}</span>
                        <span className="text-xs text-muted-foreground truncate ml-auto">{r.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <RecentlyViewed />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:flex"
                onClick={() => setAiPanelOpen(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                IA
                <kbd className="ml-1.5 px-1 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted/60 border border-border rounded">⌘J</kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abrir asistente IA (⌘J)</TooltipContent>
          </Tooltip>
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <NotificationsBell />
              </span>
            </TooltipTrigger>
            <TooltipContent>Avisos</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: "/" })}
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cerrar sesión</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
