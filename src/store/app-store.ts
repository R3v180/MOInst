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

export const useAppStore = create<AppState>((set) => ({
  view: "dashboard",
  params: {},
  sidebarOpen: false,
  aiPanelOpen: false,
  recent: [],
  setView: (view, params = {}, label) =>
    set((state) => {
      // Track detail views in recent history (max 8, dedup by view+id)
      let recent = state.recent;
      if (DETAIL_VIEWS.has(view) && label) {
        const key = `${view}:${params.id ?? ""}`;
        recent = [
          { view, params, label, timestamp: Date.now() },
          ...state.recent.filter((r) => `${r.view}:${r.params.id ?? ""}` !== key),
        ].slice(0, 8);
      }
      return { view, params, sidebarOpen: false, recent };
    }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setAiPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
}));
