"use client";

import { create } from "zustand";

export type ViewKey =
  | "dashboard"
  | "clients"
  | "client-detail"
  | "installations"
  | "installation-detail"
  | "articles"
  | "article-detail"
  | "suppliers"
  | "supplier-detail"
  | "sale-quotes"
  | "sale-quote-detail"
  | "sale-orders"
  | "sale-order-detail"
  | "purchase-quotes"
  | "purchase-quote-detail"
  | "purchase-orders"
  | "purchase-order-detail"
  | "albaranes"
  | "incidents"
  | "incident-detail"
  | "maintenances"
  | "agenda"
  | "settings"
  | "ai-chat";

export interface RecentItem {
  view: ViewKey;
  params: Record<string, string>;
  label: string;
  timestamp: number;
}

const DETAIL_VIEWS = new Set<ViewKey>([
  "client-detail", "installation-detail", "article-detail", "supplier-detail",
  "sale-quote-detail", "sale-order-detail", "purchase-quote-detail",
  "purchase-order-detail", "incident-detail",
]);

interface AppState {
  view: ViewKey;
  params: Record<string, string>;
  sidebarOpen: boolean;
  aiPanelOpen: boolean;
  recent: RecentItem[];
  setView: (view: ViewKey, params?: Record<string, string>, label?: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setAiPanelOpen: (open: boolean) => void;
}

const RECENT_KEY = "moinst-recent";
const MAX_RECENT = 8;

function loadRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(RECENT_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRecent(items: RecentItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  } catch {}
}

export const useAppStore = create<AppState>((set) => ({
  view: "dashboard",
  params: {},
  sidebarOpen: false,
  aiPanelOpen: false,
  recent: loadRecent(),
  setView: (view, params = {}, label) =>
    set((state) => {
      // Track detail views in recent history (max 8, dedup by view+id)
      let recent = state.recent;
      if (DETAIL_VIEWS.has(view) && label) {
        const key = `${view}:${params.id ?? ""}`;
        recent = [
          { view, params, label, timestamp: Date.now() },
          ...state.recent.filter((r) => `${r.view}:${r.params.id ?? ""}` !== key),
        ].slice(0, MAX_RECENT);
        saveRecent(recent);
      }
      return { view, params, sidebarOpen: false, recent };
    }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setAiPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
}));
