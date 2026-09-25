"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Check,
  AlertTriangle,
  Paperclip,
  FileText,
  Copy,
  Maximize2,
  Minimize2,
  PhoneCall,
  MessageCircle,
  CalendarPlus,
  UserPlus,
  Wrench,
  Tag,
  Package,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  AiEntityCard,
  ImageLightboxModal,
  cleanPhoneNumber,
  cleanWaNumber,
  type AiCardData,
} from "./ai-card";
import { formatCurrency, formatDateTime } from "@/lib/format";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  cards?: AiCardData[];
  actions?: AiActionCard[];
  matchedSummary?: { matched: number; notFound: number; supplier?: string } | null;
}

interface AiActionCard {
  type: string;
  label?: string;
  payload: Record<string, unknown>;
}

// Regex para detectar teléfonos españoles en texto
const PHONE_REGEX =
  /(?:(?:\+?34\s*)?[6789]\d{2}(?:[\s.-]?\d{3}){2}|(?:\+?34\s*)?[6789]\d{8})/g;

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX);
  if (!matches) return [];
  const unique = Array.from(new Set(matches.map((m) => m.replace(/[\s.-]/g, ""))));
  return unique.filter((p) => p.length >= 9 && p.length <= 12);
}

export function AiChatPanel() {
  const { aiPanelOpen, setAiPanelOpen } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Soy el asistente de MOInst. Puedo consultar clientes, buscar artículos y mejores precios, consultar instalaciones, programar citas o abrir incidencias. ¿En qué te ayudo hoy?",
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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

    const steps = ["Consultando datos en tiempo real...", "Analizando con Gemini...", "Preparando respuesta..."];
    setLoadingStep(steps[0]);
    setLoadingStepIdx(0);
    let stepI = 0;
    loadingTimerRef.current = setInterval(() => {
      stepI = Math.min(stepI + 1, steps.length - 1);
      setLoadingStep(steps[stepI]);
      setLoadingStepIdx(stepI);
    }, 3000);

    const history = next.slice(1).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    try {
      let r: Response;
      if (file) {
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
        setMessages((p) => [
          ...p,
          { role: "assistant", content: `⚠️ ${data.error ?? "Error al procesar la consulta"}\n${data.detail ?? ""}` },
        ]);
      } else {
        setMessages((p) => [
          ...p,
          {
            role: "assistant",
            content: data.text,
            cards: data.cards ?? [],
            actions: data.actions ?? [],
            matchedSummary: data.matchedSummary ?? null,
          },
        ]);
      }
    } catch (e: any) {
      setMessages((p) => [...p, { role: "assistant", content: `Error de conexión: ${e.message}` }]);
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
      toast({ title: "Acción confirmada y ejecutada", description: data.summary });
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
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />
        </button>
      )}

      {/* Panel Asistente */}
      {aiPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
            onClick={() => setAiPanelOpen(false)}
          />
          <Card
            className={cn(
              "relative w-full m-0 sm:m-4 rounded-none sm:rounded-2xl flex flex-col shadow-2xl border-border transition-all duration-200 overflow-hidden bg-background",
              isExpanded ? "sm:max-w-2xl" : "sm:max-w-md"
            )}
          >
            {/* Header del Asistente */}
            <div className="flex items-center gap-2.5 p-3.5 border-b border-border bg-gradient-to-r from-primary via-primary/95 to-primary/85 text-primary-foreground shadow-sm">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5 leading-none">
                  <span>Asistente MOInst</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-mono font-normal">
                    Gemini
                  </span>
                </div>
                <div className="text-[11px] opacity-85 mt-0.5 truncate">
                  Clientes · Materiales · Citas · Incidencias · Llamadas directas
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-white/15 h-8 w-8 hidden sm:flex"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Reducir panel" : "Expandir panel"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-white/15 h-8 w-8"
                onClick={() => setAiPanelOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Mensajes del Chat */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-3 sm:p-4 space-y-3.5 bg-muted/20">
              {messages.map((m, i) => {
                const detectedPhones = m.role === "assistant" ? extractPhones(m.content) : [];

                return (
                  <div key={i} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm text-xs font-bold",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-gradient-to-br from-emerald-600 to-teal-700 text-white"
                      )}
                    >
                      {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-card border border-border text-card-foreground rounded-tl-none"
                      )}
                    >
                      {/* Resumen de lista de precios parseada */}
                      {m.matchedSummary && (
                        <div className="mb-2 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-2 text-xs flex items-center gap-2 flex-wrap">
                          <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-primary">Lista procesada:</span>
                          <span className="text-emerald-600 font-medium">
                            {m.matchedSummary.matched} encontrados en BD
                          </span>
                          {m.matchedSummary.notFound > 0 && (
                            <span className="text-amber-600 font-medium">
                              {m.matchedSummary.notFound} nuevos
                            </span>
                          )}
                          {m.matchedSummary.supplier && (
                            <span className="text-muted-foreground">· Proveedor: {m.matchedSummary.supplier}</span>
                          )}
                        </div>
                      )}

                      {/* Contenido en Markdown enriquecido */}
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-card-foreground break-words space-y-1 leading-relaxed">
                          <ReactMarkdown
                            components={{
                              a: ({ href, children }) => {
                                if (href?.startsWith("tel:")) {
                                  return (
                                    <a
                                      href={href}
                                      className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs"
                                    >
                                      <PhoneCall className="w-3 h-3 inline" /> {children}
                                    </a>
                                  );
                                }
                                if (href?.startsWith("https://wa.me/")) {
                                  return (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 font-semibold text-[#25D366] hover:underline bg-[#25D366]/10 px-1.5 py-0.5 rounded text-xs"
                                    >
                                      <MessageCircle className="w-3 h-3 inline" /> {children}
                                    </a>
                                  );
                                }
                                return (
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                    {children}
                                  </a>
                                );
                              },
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
                      )}

                      {/* Chips de llamada rápida si el texto menciona teléfonos */}
                      {detectedPhones.length > 0 && (!m.cards || m.cards.length === 0) && (
                        <div className="mt-2.5 pt-2 border-t border-border flex items-center gap-1.5 flex-wrap">
                          {detectedPhones.map((ph, pi) => {
                            const clean = cleanPhoneNumber(ph);
                            const wa = cleanWaNumber(ph);
                            return (
                              <div key={pi} className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                                <a
                                  href={`tel:${clean}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition-all"
                                  title="Llamar"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>{ph}</span>
                                </a>
                                {wa && (
                                  <a
                                    href={`https://wa.me/${wa}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded-md bg-[#25D366] text-white hover:bg-[#20ba59]"
                                    title="WhatsApp"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Tarjetas interactivas de entidades (Cliente, Artículo, etc.) */}
                      {m.cards && m.cards.length > 0 && (
                        <div className="mt-2.5 space-y-2">
                          {m.cards.map((c, ci) => (
                            <AiEntityCard key={ci} card={c} onImageClick={setLightboxImage} />
                          ))}
                        </div>
                      )}

                      {/* Tarjetas de Acción Propuesta (Rediseño visual completo) */}
                      {m.actions && m.actions.length > 0 && (
                        <div className="mt-3 space-y-2.5">
                          {m.actions.map((a, ai) => {
                            const key = `${i}-${a.type}`;
                            const state = pendingActions[key];

                            return (
                              <ActionProposalCard
                                key={ai}
                                action={a}
                                state={state}
                                result={actionResults[key]}
                                onApply={() => runAction(a, i)}
                              />
                            );
                          })}
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-primary" />
                            <span>Confirmación segura: pulsa «Confirmar y Aplicar» para guardar en la base de datos.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Indicador de carga activo */}
              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-tl-none px-4 py-3 text-sm text-card-foreground shadow-sm space-y-2 max-w-[85%]">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span className="font-medium text-xs text-foreground animate-pulse">
                        {loadingStep}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {["Consulta BD", "Gemini AI", "Formateando"].map((s, idx) => (
                        <div
                          key={s}
                          className={cn(
                            "h-1.5 rounded-full transition-all duration-300",
                            loadingStepIdx > idx
                              ? "w-8 bg-primary"
                              : loadingStepIdx === idx
                              ? "w-10 bg-primary/70 animate-pulse"
                              : "w-6 bg-muted"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input del Chat */}
            <div className="border-t border-border p-3 bg-background">
              {attachedFile && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 shadow-sm">
                  <Paperclip className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate flex-1">
                    {attachedFile.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {(attachedFile.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="text-muted-foreground hover:text-destructive shrink-0 p-0.5"
                    title="Quitar archivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={onFile}
                  accept=".pdf,image/*,.xlsx,.xls,.csv,.txt"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-10 w-10 rounded-xl"
                  onClick={() => fileRef.current?.click()}
                  title="Adjuntar lista de precios, documento o foto"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={
                    attachedFile
                      ? "Indica qué hacer con el archivo adjunto..."
                      : "Pregunta por un cliente, artículo, llama o agenda..."
                  }
                  className="h-10 rounded-xl text-sm"
                  disabled={loading}
                />
                <Button
                  size="icon"
                  className="shrink-0 h-10 w-10 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95"
                  onClick={send}
                  disabled={loading || (!input.trim() && !attachedFile)}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Lightbox para fotos */}
      <ImageLightboxModal url={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Rediseñado de Tarjeta de Acción
// ─────────────────────────────────────────────────────────────────────────────
function ActionProposalCard({
  action,
  state,
  result,
  onApply,
}: {
  action: AiActionCard;
  state?: "pending" | "done" | "error";
  result?: any;
  onApply: () => void;
}) {
  const meta = getActionMeta(action.type, action.payload);

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 shadow-sm transition-all",
        state === "done"
          ? "border-emerald-500/40 bg-emerald-500/5"
          : state === "error"
          ? "border-destructive/40 bg-destructive/5"
          : "border-primary/30 bg-primary/5"
      )}
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
              state === "done"
                ? "bg-emerald-500 text-white"
                : "bg-primary text-primary-foreground"
            )}
          >
            {state === "done" ? <Check className="w-4 h-4" /> : meta.icon}
          </div>
          <div>
            <div className="text-xs font-bold text-foreground leading-tight">
              {meta.title}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {action.label || action.type}
            </div>
          </div>
        </div>
        {state === "done" ? (
          <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
            Aplicado
          </Badge>
        ) : state === "error" ? (
          <Badge variant="destructive" className="text-[10px]">
            Error
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
            Propuesta
          </Badge>
        )}
      </div>

      {/* Campos legibles organizados */}
      {meta.fields.length > 0 && (
        <div className="my-2.5 rounded-lg bg-background/80 border border-border p-2 space-y-1 text-xs">
          {meta.fields.map((f, fi) => (
            <div key={fi} className="flex justify-between items-start gap-2">
              <span className="text-[11px] text-muted-foreground">{f.label}:</span>
              <span className="font-medium text-foreground text-right">{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Render especial si es email */}
      {action.type === "compose_email" && (
        <div className="mt-2 rounded-lg border border-border bg-background p-2.5 space-y-1.5">
          {Boolean(action.payload.to) && (
            <div className="text-[11px] text-muted-foreground">
              Para: <span className="font-semibold text-foreground">{String(action.payload.to)}</span>
            </div>
          )}
          {Boolean(action.payload.subject) && (
            <div className="text-[11px] text-muted-foreground">
              Asunto: <span className="font-semibold text-foreground">{String(action.payload.subject)}</span>
            </div>
          )}
          <textarea
            readOnly
            className="w-full text-xs bg-muted/40 rounded p-2 border border-border resize-y min-h-[75px] scroll-thin"
            value={String(action.payload.body ?? "")}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => {
              navigator.clipboard?.writeText(String(action.payload.body ?? ""));
              toast({ title: "Email copiado", description: "Pégalo en tu aplicación de correo" });
            }}
          >
            <Copy className="w-3.5 h-3.5" /> Copiar texto
          </Button>
        </div>
      )}

      {/* Botón de Aplicar / Confirmar */}
      {state === "done" ? (
        <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Registrado correctamente en la base de datos.</span>
        </div>
      ) : state === "error" ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-destructive">Hubo un problema al aplicar</span>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={onApply}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center justify-end gap-2">
          <Button
            size="sm"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium shadow-sm gap-1.5"
            onClick={onApply}
            disabled={state === "pending"}
          >
            {state === "pending" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Aplicando...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" /> Confirmar y Aplicar
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function getActionMeta(
  type: string,
  payload: Record<string, any>
): { title: string; icon: React.ReactNode; fields: { label: string; value: string }[] } {
  const fields: { label: string; value: string }[] = [];

  switch (type) {
    case "create_client":
      if (payload.name) fields.push({ label: "Nombre", value: String(payload.name) });
      if (payload.phonePrimary) fields.push({ label: "Teléfono", value: String(payload.phonePrimary) });
      if (payload.city) fields.push({ label: "Población", value: String(payload.city) });
      return { title: "Alta de Nuevo Cliente", icon: <UserPlus className="w-4 h-4" />, fields };

    case "create_appointment":
      if (payload.startAt) fields.push({ label: "Fecha y hora", value: formatDateTime(payload.startAt) });
      if (payload.type) fields.push({ label: "Tipo", value: String(payload.type) });
      if (payload.address) fields.push({ label: "Dirección", value: String(payload.address) });
      return { title: "Programar Cita en Agenda", icon: <CalendarPlus className="w-4 h-4" />, fields };

    case "create_installation":
      if (payload.equipmentType) fields.push({ label: "Tipo de equipo", value: String(payload.equipmentType) });
      if (payload.brand) fields.push({ label: "Marca", value: String(payload.brand) });
      if (payload.model) fields.push({ label: "Modelo", value: String(payload.model) });
      if (payload.serialNumber) fields.push({ label: "Nº Serie", value: String(payload.serialNumber) });
      return { title: "Registrar Instalación", icon: <Wrench className="w-4 h-4" />, fields };

    case "create_incident":
      if (payload.description) fields.push({ label: "Motivo", value: String(payload.description) });
      return { title: "Abrir Incidencia", icon: <AlertTriangle className="w-4 h-4" />, fields };

    case "create_sale_quote":
      if (payload.lines && Array.isArray(payload.lines)) {
        fields.push({ label: "Líneas de material", value: `${payload.lines.length} conceptos` });
      }
      return { title: "Crear Presupuesto", icon: <FileText className="w-4 h-4" />, fields };

    case "set_article_price":
      if (payload.price !== undefined) fields.push({ label: "Nuevo precio", value: formatCurrency(payload.price) });
      if (payload.supplierRef) fields.push({ label: "Ref. Proveedor", value: String(payload.supplierRef) });
      return { title: "Actualizar Precio Proveedor", icon: <Tag className="w-4 h-4" />, fields };

    case "adjust_stock":
      if (payload.delta !== undefined) fields.push({ label: "Ajuste", value: `${payload.delta > 0 ? "+" : ""}${payload.delta} ud` });
      return { title: "Ajustar Stock", icon: <Package className="w-4 h-4" />, fields };

    case "compose_email":
      return { title: "Redactar Email", icon: <Mail className="w-4 h-4" />, fields };

    default:
      return { title: type.replace(/_/g, " "), icon: <Sparkles className="w-4 h-4" />, fields };
  }
}
