"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">Algo salió mal</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {this.state.error?.message ?? "Error inesperado al cargar esta vista."}
            </p>
          </div>
          <Button onClick={() => this.setState({ hasError: false })}>
            Reintentar
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
