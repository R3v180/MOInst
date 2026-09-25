"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Thermometer, Snowflake } from "lucide-react";
import { LoginScreen } from "@/components/app/login-screen";
import { AppShell } from "@/components/app/app-shell";

export default function Home() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-1 p-2 rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Snowflake className="w-5 h-5" />
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MOInst</h1>
            <p className="text-xs text-muted-foreground">Gestión para instaladores</p>
          </div>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;
  return <AppShell />;
}
