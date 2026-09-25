"use client";

import { useAppStore, type RecentItem, type ViewKey } from "@/store/app-store";
import { cn } from "@/lib/utils";
import {
  Users, Wrench, Package, Truck, FileText, ClipboardList, Siren, X, Clock,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

const ICONS: Partial<Record<ViewKey, React.ComponentType<{ className?: string }>>> = {
  "client-detail": Users,
  "installation-detail": Wrench,
  "article-detail": Package,
  "supplier-detail": Truck,
  "sale-quote-detail": FileText,
  "sale-order-detail": ClipboardList,
  "purchase-quote-detail": FileText,
  "purchase-order-detail": ClipboardList,
  "incident-detail": Siren,
};

export function RecentlyViewed() {
  const { recent, setView } = useAppStore();
  const [overflow, setOverflow] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      setOverflow(el.scrollWidth > el.clientWidth);
    }
  }, [recent]);

  if (recent.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="hidden lg:flex items-center gap-1 max-w-[280px] overflow-x-auto scroll-thin ml-2"
    >
      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      {recent.map((item) => {
        const Icon = ICONS[item.view] ?? FileText;
        return (
          <button
            key={`${item.view}-${item.params.id}`}
            onClick={() => setView(item.view, item.params, item.label)}
            className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent hover:border-border transition-all whitespace-nowrap shrink-0"
            title={item.label}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span className="max-w-[100px] truncate">{item.label}</span>
          </button>
        );
      })}
      {overflow && (
        <span className="text-[10px] text-muted-foreground shrink-0 px-1">→</span>
      )}
    </div>
  );
}
