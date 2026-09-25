"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Package, ShieldAlert, FileText, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppStore, type ViewKey } from "@/store/app-store";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AlertsData {
  lowStockCount: number;
  openIncidentsCount: number;
  pendingQuotesCount: number;
  expiringWarrantiesCount: number;
}

interface BellItem {
  key: keyof AlertsData;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  view: ViewKey;
}

const ITEMS: BellItem[] = [
  { key: "lowStockCount", label: "Stock bajo", icon: Package, view: "articles" },
  { key: "expiringWarrantiesCount", label: "Garantías a caducar", icon: ShieldAlert, view: "installations" },
  { key: "pendingQuotesCount", label: "Presupuestos sin respuesta", icon: FileText, view: "sale-quotes" },
  { key: "openIncidentsCount", label: "Incidencias abiertas", icon: Siren, view: "incidents" },
];

export function NotificationsBell() {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<AlertsData>({
    queryKey: ["alerts"],
    queryFn: async () => {
      const r = await fetch("/api/alerts");
      if (!r.ok) throw new Error("No autorizado");
      return r.json() as Promise<AlertsData>;
    },
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const total =
    (data?.lowStockCount ?? 0) +
    (data?.openIncidentsCount ?? 0) +
    (data?.pendingQuotesCount ?? 0) +
    (data?.expiringWarrantiesCount ?? 0);

  function go(v: ViewKey) {
    setOpen(false);
    useAppStore.getState().setView(v);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Avisos"
          aria-label={`Avisos${total > 0 ? `: ${total} sin revisar` : ""}`}
        >
          <Bell className="w-5 h-5" />
          {total > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px]",
                "px-1 grid place-items-center rounded-full",
                "bg-destructive text-destructive-foreground",
                "text-[10px] font-semibold leading-none",
                "ring-2 ring-background"
              )}
            >
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 p-0"
      >
        <div className="px-3 py-2 border-b border-border">
          <p className="text-sm font-semibold">Avisos</p>
        </div>
        <div className="py-1 max-h-80 overflow-y-auto scroll-thin">
          {isLoading ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Cargando avisos...
            </div>
          ) : total === 0 ? (
            <div className="px-3 py-6 text-sm text-muted-foreground text-center">
              Sin avisos
            </div>
          ) : (
            <ul className="py-1">
              {ITEMS.map((it) => {
                const count = data?.[it.key] ?? 0;
                const Icon = it.icon;
                const active = count > 0;
                return (
                  <li key={it.key}>
                    <button
                      type="button"
                      disabled={!active}
                      onClick={() => active && go(it.view)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left",
                        active ? "hover:bg-accent cursor-pointer" : "opacity-50 cursor-default"
                      )}
                    >
                      <span
                        className={cn(
                          "grid place-items-center w-7 h-7 rounded-md shrink-0",
                          active
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-sm flex-1 truncate">{it.label}</span>
                      <span
                        className={cn(
                          "text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[22px] text-center",
                          active
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
