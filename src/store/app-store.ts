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

interface AppState {
  view: ViewKey;
  params: Record<string, string>;
  sidebarOpen: boolean;
  aiPanelOpen: boolean;
  setView: (view: ViewKey, params?: Record<string, string>) => void;
  setSidebarOpen: (open: boolean) => void;
  setAiPanelOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "dashboard",
  params: {},
  sidebarOpen: false,
  aiPanelOpen: false,
  setView: (view, params = {}) =>
    set({ view, params, sidebarOpen: false }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setAiPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
}));
