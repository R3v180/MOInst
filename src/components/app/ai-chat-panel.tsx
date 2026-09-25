"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, X, Send, Bot, User, Check, AlertTriangle, Paperclip, FileText, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: AiActionCard[];
  matchedSummary?: { matched: number; notFound: number; supplier?: string } | null;
}

interface AiActionCard {
  type: string;
  label?: string;
  payload: Record<string, unknown>;
}

export function AiChatPanel() {
  const { aiPanelOpen, setAiPanelOpen } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hola. Soy el asistente de MOInst. Puedo consultar clientes, instalaciones, presupuestos, abrir incidencias, programar citas y mucho más. ¿Qué necesitas?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("Analizando tu consulta...");
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, "pending" | "done" | "error">>({});
  const [actionResults, setActionResults] = useState<Record<string, any>>({});
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send() {
    if (loading) return;
    const userMsg = input.trim();
    const file = attachedFile;
    if (!userMsg && !file) return;
    setInput("");
    setAttachedFile(null);
    const displayContent = file ? `📎 ${file.name}${userMsg ? " — " + userMsg : ""}` : userMsg;
    const next = [...messages, { role: "user", content: displayContent } as ChatMessage];
    setMessages(next);
    setLoading(true);
    // Indicador de progreso: cicla por mensajes cada 3.5s
    const steps = ["Analizando tu consulta...", "Consultando la base de datos...", "Preparando respuesta..."];
    setLoadingStep(steps[0]);
    setLoadingStepIdx(0);
    let stepI = 0;
    loadingTimerRef.current = setInterval(() => {
      stepI = Math.min(stepI + 1, steps.length - 1);
      setLoadingStep(steps[stepI]);
      setLoadingStepIdx(stepI);
    }, 3500);

    const history = next.slice(1).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    try {
      let r: Response;
      if (file) {
        // Subida con archivo (FormData): el backend parsea CSV/Excel
        const fd = new FormData();
        fd.append("message", userMsg);
        fd.append("history", JSON.stringify(history));
        fd.append("file", file);
        r = await fetch("/api/ai/chat", { method: "POST", body: fd });
      } else {
        r = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMsg, history }),
        });
      }
      const data = await r.json();
      if (!r.ok) {
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${data.error ?? "Error"}\n${data.detail ?? ""}` }]);
      } else {
        setMessages((p) => [
          ...p,
          { role: "assistant", content: data.text, actions: data.actions ?? [], matchedSummary: data.matchedSummary ?? null },
        ]);
      }
    } catch (e: any) {
      setMessages((p) => [...p, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setLoading(false);
    }
  }

  async function runAction(action: AiActionCard, index: number) {
    const key = `${index}-${action.type}`;
    setPendingActions((p) => ({ ...p, [key]: "pending" }));
    try {
      const r = await fetch("/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = await r.json();
      if (!r.ok) {
        setPendingActions((p) => ({ ...p, [key]: "error" }));
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      setPendingActions((p) => ({ ...p, [key]: "done" }));
      setActionResults((p) => ({ ...p, [key]: data.result }));
      toast({ title: "Acción ejecutada", description: data.summary });
      // Invalida queries para refrescar UI
      qc.invalidateQueries();
    } catch (e: any) {
      setPendingActions((p) => ({ ...p, [key]: "error" }));
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo demasiado grande", description: "Máximo 5MB", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setAttachedFile(f);
    e.target.value = "";
  }

  return (
    <>
      {/* Botón flotante */}
      {!aiPanelOpen && (
        <button
          onClick={() => setAiPanelOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent border-2 border-background" />
        </button>
      )}

      {/* Panel */}
      {aiPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
            onClick={() => setAiPanelOpen(false)}
          />
          <Card className="relative w-full sm:max-w-md m-0 sm:m-4 rounded-none sm:rounded-xl flex flex-col shadow-2xl border-border">
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-t-xl">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Asistente MOInst</div>
                <div className="text-[10px] opacity-80">Consulta y opera sobre tus datos</div>
              </div>
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setAiPanelOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-3 space-y-3 bg-muted/30">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
                    {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border border-border")}>
                    {m.matchedSummary && (
                      <div className="mb-2 rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-[11px] flex items-center gap-2 flex-wrap">
                        <Paperclip className="w-3 h-3 text-primary shrink-0" />
                        <span className="font-medium text-primary">Lista de precios procesada:</span>
                        <span className="text-green-600 font-medium">{m.matchedSummary.matched} encontrados</span>
                        {m.matchedSummary.notFound > 0 && (
                          <span className="text-amber-600 font-medium">{m.matchedSummary.notFound} nuevos</span>
                        )}
                        {m.matchedSummary.supplier && (
                          <span className="text-muted-foreground">· {m.matchedSummary.supplier}</span>
                        )}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {m.actions.map((a, ai) => {
                          const key = `${i}-${a.type}`;
                          const state = pendingActions[key];
                          return (
                            <div key={ai} className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
                              <div className="text-[11px] font-semibold uppercase text-primary mb-1 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Acción propuesta
                              </div>
                              <div className="text-xs font-medium mb-2">{a.label ?? a.type}</div>
                              {state === "done" ? (
                                <div className="text-xs text-green-600 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Aplicado
                                </div>
                              ) : state === "error" ? (
                                <div className="text-xs text-destructive flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Error al aplicar
                                </div>
                              ) : state === "pending" ? (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Aplicando...
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button size="sm" className="h-7 text-xs" onClick={() => runAction(a, i)}>
                                    <Check className="w-3 h-3 mr-1" /> Aplicar
                                  </Button>
                                </div>
                              )}
                              {/* Render especial para emails redactados */}
                              {state === "done" && a.type === "compose_email" && actionResults[key] && (
                                <div className="mt-2 rounded border border-border bg-background p-2">
                                  {actionResults[key].to && (
                                    <div className="text-[10px] text-muted-foreground">Para: <span className="font-medium text-foreground">{actionResults[key].to}</span></div>
                                  )}
                                  {actionResults[key].subject && (
                                    <div className="text-[10px] text-muted-foreground">Asunto: <span className="font-medium text-foreground">{actionResults[key].subject}</span></div>
                                  )}
                                  <textarea
                                    readOnly
                                    className="mt-1 w-full text-xs bg-muted/50 rounded p-2 border border-border resize-y min-h-[80px] scroll-thin"
                                    value={actionResults[key].body ?? ""}
                                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs mt-1"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(actionResults[key].body ?? "");
                                      toast({ title: "Email copiado", description: "Pégalo en tu cliente de correo" });
                                    }}
                                  >
                                    <Copy className="w-3 h-3 mr-1" /> Copiar
                                  </Button>
                                </div>
                              )}
                              <details className="mt-1">
                                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Ver detalle</summary>
                                <pre className="text-[10px] mt-1 bg-muted p-1.5 rounded overflow-x-auto scroll-thin">{JSON.stringify(a.payload, null, 2)}</pre>
                              </details>
                            </div>
                          );
                        })}
                        <div className="text-[10px] text-muted-foreground italic">
                          Confirmación requerida: la acción no se aplica hasta que pulses "Aplicar".
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="animate-pulse-soft">{loadingStep}</span>
                    </div>
                    {/* Indicador visual de pasos */}
                    <div className="flex items-center gap-1">
                      {["Analizando", "Consultando", "Preparando"].map((s, i) => (
                        <div
                          key={s}
                          className={cn(
                            "h-1 rounded-full transition-all",
                            loadingStepIdx > i ? "w-6 bg-primary" : loadingStepIdx === i ? "w-8 bg-primary/60 animate-pulse" : "w-6 bg-muted"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-2 bg-background">
              {attachedFile && (
                <div className="mb-1.5 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate flex-1">{attachedFile.name}</span>
                  <span className="text-[10px] text-muted-foreground">{(attachedFile.size / 1024).toFixed(0)} KB</span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    title="Quitar archivo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-1">
                <input ref={fileRef} type="file" className="hidden" onChange={onFile} accept=".pdf,image/*,.xlsx,.xls,.csv,.txt" />
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => fileRef.current?.click()} title="Adjuntar archivo (CSV/Excel de precios, PDF, foto)">
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={attachedFile ? "Describe qué hacer con el archivo (ej. 'actualiza precios del proveedor X')..." : "Escribe tu consulta o petición..."}
                  className="h-9"
                  disabled={loading}
                />
                <Button size="icon" className="shrink-0 h-9 w-9" onClick={send} disabled={loading || (!input.trim() && !attachedFile)}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Las acciones de creación/modificación requieren confirmación.
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
