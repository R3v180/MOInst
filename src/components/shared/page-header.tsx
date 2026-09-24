"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useAppStore, type ViewKey } from "@/store/app-store";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  backTo?: ViewKey;
  backParams?: Record<string, string>;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  backTo,
  backParams,
  actions,
  className,
}: PageHeaderProps) {
  const { setView } = useAppStore();
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6", className)}>
      <div className="min-w-0">
        {backTo && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 h-8 text-muted-foreground"
            onClick={() => setView(backTo, backParams)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Volver
          </Button>
        )}
        <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
