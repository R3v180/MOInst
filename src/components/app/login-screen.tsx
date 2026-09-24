"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Snowflake, Thermometer, Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("socio1@moinst.local");
  const [password, setPassword] = useState("moinst123");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      toast({ title: "Acceso denegado", description: "Email o contraseña incorrectos", variant: "destructive" });
      return;
    }
    toast({ title: "Sesión iniciada", description: "Bienvenido a MOInst" });
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/10 via-background to-accent/20">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="grid grid-cols-2 gap-1 p-3 rounded-2xl bg-primary text-primary-foreground shadow-xl mb-4">
              <Snowflake className="w-7 h-7" />
              <Thermometer className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">MOInst</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Gestión integral para instaladores de climatización, calderas y termos
            </p>
          </div>

          <Card className="shadow-lg border-border/60">
            <CardHeader>
              <CardTitle className="text-xl">Iniciar sesión</CardTitle>
              <CardDescription>Acceso para los socios</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      placeholder="socio@moinst.local"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Entrar
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Demo: socio1@moinst.local · moinst123
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
      <footer className="py-4 text-center text-xs text-muted-foreground">
        MOInst · Aplicación interna · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
