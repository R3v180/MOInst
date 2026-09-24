"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 py-12 px-4 text-center overflow-hidden rounded-md",
        // Gradiente sutil teal→ámbar (paleta MOInst) sobre el fondo del contenedor
        "bg-gradient-to-br from-primary/[0.04] via-transparent to-amber-500/[0.04]",
        className,
      )}
    >
      {/* Halo decorativo detrás del icon */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-primary/5 blur-2xl"
      />
      {icon && (
        <div className="relative w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm ring-1 ring-primary/10">
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-md">
        <h3 className="font-semibold text-base">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
