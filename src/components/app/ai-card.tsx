"use client";

import React from "react";
import { useAppStore } from "@/store/app-store";
import { formatCurrency, formatDate, formatDateTime, initials } from "@/lib/format";
import {
  PhoneCall,
  MessageCircle,
  Mail,
  MapPin,
  ExternalLink,
  Package,
  Flame,
  AirVent,
  Thermometer,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  FileText,
  Building2,
  Wrench,
  Maximize2,
  X,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface AiCardData {
  type:
    | "client"
    | "article"
    | "supplier"
    | "installation"
    | "appointment"
    | "incident"
    | "sale_quote"
    | "sale_order";
  data: Record<string, any>;
}

// Limpia teléfono para enlaces tel: y WhatsApp
export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "");
}

export function cleanWaNumber(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d]/g, "");
  if (cleaned.length === 9 && (cleaned.startsWith("6") || cleaned.startsWith("7"))) {
    return `34${cleaned}`;
  }
  return cleaned;
}

export function AiEntityCard({
  card,
  onImageClick,
}: {
  card: AiCardData;
  onImageClick?: (url: string) => void;
}) {
  const { setView } = useAppStore();
  const { type, data } = card;

  switch (type) {
    case "client":
      return <ClientCard client={data} setView={setView} />;
    case "article":
      return <ArticleCard article={data} setView={setView} onImageClick={onImageClick} />;
    case "supplier":
      return <SupplierCard supplier={data} setView={setView} />;
    case "installation":
      return <InstallationCard installation={data} setView={setView} onImageClick={onImageClick} />;
    case "appointment":
      return <AppointmentCard appointment={data} setView={setView} />;
    case "incident":
      return <IncidentCard incident={data} setView={setView} onImageClick={onImageClick} />;
    case "sale_quote":
      return <SaleQuoteCard quote={data} setView={setView} />;
    case "sale_order":
      return <SaleOrderCard order={data} setView={setView} />;
    default:
      return null;
  }
}

// 1. Tarjeta de Cliente
function ClientCard({
  client,
  setView,
}: {
  client: any;
  setView: (view: any, params?: any, label?: string) => void;
}) {
  const phone = client.phonePrimary || client.phone || client.phoneSecondary;
  const cleanPhone = cleanPhoneNumber(phone);
  const waPhone = cleanWaNumber(phone);
  const address = [client.addressStreet, client.addressNumber, client.addressFloor, client.city]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="my-2 rounded-xl border border-primary/20 bg-card p-3 shadow-md transition-all hover:border-primary/40 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 font-bold text-primary-foreground text-xs shadow-sm">
            {initials(client.name || "C")}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm leading-tight text-foreground truncate">
              {client.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
              {client.city && <span>📍 {client.city}</span>}
              {client.nif && <span className="opacity-75">· {client.nif}</span>}
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-semibold shrink-0 text-primary border-primary/30">
          Cliente
        </Badge>
      </div>

      {address && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded-md">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span className="truncate flex-1">{address}</span>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline shrink-0 font-medium"
          >
            Mapa
          </a>
        </div>
      )}

      {(client.installationsCount !== undefined || client.openIncidentsCount !== undefined) && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {client.installationsCount !== undefined && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1 font-medium">
              <Wrench className="w-3 h-3 text-muted-foreground" />
              {client.installationsCount} {client.installationsCount === 1 ? "instalación" : "instalaciones"}
            </Badge>
          )}
          {client.openIncidentsCount !== undefined && client.openIncidentsCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5 gap-1 font-medium">
              <AlertTriangle className="w-3 h-3" />
              {client.openIncidentsCount} {client.openIncidentsCount === 1 ? "incidencia abierta" : "incidencias"}
            </Badge>
          )}
        </div>
      )}

      {client.notes && (
        <p className="mt-2 text-[11px] text-muted-foreground italic line-clamp-2 bg-muted/20 p-1.5 rounded">
          "{client.notes}"
        </p>
      )}

      <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-1.5 flex-wrap">
        {cleanPhone && (
          <a
            href={`tel:${cleanPhone}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium text-xs shadow-sm transition-all"
            title="Llamar directamente al cliente"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Llamar</span>
          </a>
        )}
        {waPhone && (
          <a
            href={`https://wa.me/${waPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white font-medium text-xs shadow-sm transition-all"
            title="Abrir chat de WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
        )}
        {client.email && (
          <a
            href={`mailto:${client.email}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 active:scale-95 text-foreground text-xs transition-all border border-border"
            title="Enviar correo"
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
        )}
        {client.id && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs ml-auto gap-1 text-primary border-primary/30 hover:bg-primary/5 active:scale-95"
            onClick={() => setView("client-detail", { id: client.id }, client.name)}
          >
            <span>Ver ficha</span>
            <ExternalLink className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// 2. Tarjeta de Artículo
function ArticleCard({
  article,
  setView,
  onImageClick,
}: {
  article: any;
  setView: (view: any, params?: any, label?: string) => void;
  onImageClick?: (url: string) => void;
}) {
  const stock = Number(article.stock ?? 0);
  const stockMin = Number(article.stockMin ?? 0);
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= stockMin;
  const images = article.images || [];

  return (
    <div className="my-2 rounded-xl border border-primary/20 bg-card p-3 shadow-md transition-all hover:border-primary/40 text-card-foreground">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {article.internalCode && (
            <Badge variant="secondary" className="text-[10px] font-mono font-bold">
              #{article.internalCode}
            </Badge>
          )}
          {article.brand && (
            <Badge variant="outline" className="text-[10px] font-medium">
              {article.brand}
            </Badge>
          )}
          {article.category && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {article.category}
            </span>
          )}
        </div>
        {isOutOfStock ? (
          <Badge variant="destructive" className="text-[10px] h-5">
            Sin stock
          </Badge>
        ) : isLowStock ? (
          <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-500/40 bg-amber-500/10">
            Stock bajo ({stock})
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] h-5 text-emerald-600 border-emerald-500/40 bg-emerald-500/10">
            Stock: {stock} {article.unit || "ud"}
          </Badge>
        )}
      </div>

      <h4 className="font-semibold text-sm text-foreground leading-snug">{article.name}</h4>
      {article.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{article.description}</p>
      )}

      {images.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
          {images.map((imgUrl: string, idx: number) => (
            <button
              key={idx}
              type="button"
              onClick={() => onImageClick?.(imgUrl)}
              className="relative aspect-square w-16 h-16 rounded-lg overflow-hidden border border-border group shrink-0 hover:opacity-90 transition-opacity"
            >
              <img src={imgUrl} alt={article.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                <Maximize2 className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      )}

      {(article.price !== undefined || article.latestPrice !== undefined) && (
        <div className="mt-2.5 rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground text-[11px] flex items-center gap-1">
            <Tag className="w-3 h-3 text-primary" />
            Mejor precio compra:
          </span>
          <div className="text-right">
            <span className="font-bold text-primary">
              {formatCurrency(article.price ?? article.latestPrice)}
            </span>
            {article.latestSupplier && (
              <span className="text-[10px] text-muted-foreground ml-1">({article.latestSupplier})</span>
            )}
          </div>
        </div>
      )}

      {article.id && (
        <div className="mt-3 pt-2 border-t border-border flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 active:scale-95"
            onClick={() => setView("article-detail", { id: article.id }, article.name)}
          >
            <span>Ver artículo en catálogo</span>
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// 3. Tarjeta de Proveedor
function SupplierCard({
  supplier,
  setView,
}: {
  supplier: any;
  setView: (view: any, params?: any, label?: string) => void;
}) {
  const phone = supplier.phone;
  const cleanPhone = cleanPhoneNumber(phone);
  const waPhone = cleanWaNumber(phone);

  return (
    <div className="my-2 rounded-xl border border-primary/20 bg-card p-3 shadow-md transition-all hover:border-primary/40 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate">{supplier.name}</h4>
            {supplier.contactName && (
              <p className="text-[11px] text-muted-foreground">Contacto: {supplier.contactName}</p>
            )}
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-semibold text-amber-600 border-amber-500/30">
          Proveedor
        </Badge>
      </div>

      {supplier.address && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{supplier.address}</span>
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-1.5 flex-wrap">
        {cleanPhone && (
          <a
            href={`tel:${cleanPhone}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium text-xs shadow-sm transition-all"
            title="Llamar al proveedor"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Llamar</span>
          </a>
        )}
        {waPhone && (
          <a
            href={`https://wa.me/${waPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white font-medium text-xs shadow-sm transition-all"
            title="WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
        )}
        {supplier.email && (
          <a
            href={`mailto:${supplier.email}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs transition-all border border-border"
            title="Enviar email"
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
        )}
        {supplier.id && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs ml-auto gap-1 text-primary border-primary/30 hover:bg-primary/5 active:scale-95"
            onClick={() => setView("supplier-detail", { id: supplier.id }, supplier.name)}
          >
            <span>Ver proveedor</span>
            <ExternalLink className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// 4. Tarjeta de Instalación
function InstallationCard({
  installation,
  setView,
  onImageClick,
}: {
  installation: any;
  setView: (view: any, params?: any, label?: string) => void;
  onImageClick?: (url: string) => void;
}) {
  const eq = (installation.equipmentType || "").toLowerCase();
  const Icon = eq.includes("aire") || eq.includes("clima") || eq.includes("ac")
    ? AirVent
    : eq.includes("caldera")
    ? Flame
    : Thermometer;

  const images = installation.images || [];
  const isWarrantyActive =
    installation.warrantyEndDate && new Date(installation.warrantyEndDate).getTime() > Date.now();

  return (
    <div className="my-2 rounded-xl border border-primary/20 bg-card p-3 shadow-md transition-all hover:border-primary/40 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate">
              {installation.equipmentType || "Instalación"}
            </h4>
            <div className="text-[11px] text-muted-foreground">
              {installation.brand} {installation.model}
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
          {installation.status || "ACTIVA"}
        </Badge>
      </div>

      {installation.serialNumber && (
        <div className="mt-2 text-xs font-mono bg-muted/40 px-2 py-1 rounded inline-block text-muted-foreground">
          S/N: <span className="font-semibold text-foreground">{installation.serialNumber}</span>
        </div>
      )}

      {installation.clientName && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <span>Cliente:</span>
          <span className="font-medium text-foreground">{installation.clientName}</span>
          {installation.clientId && (
            <button
              onClick={() => setView("client-detail", { id: installation.clientId })}
              className="text-primary hover:underline ml-1 text-[11px]"
            >
              (ver)
            </button>
          )}
        </div>
      )}

      {installation.warrantyEndDate && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {isWarrantyActive ? (
            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 gap-1">
              <ShieldCheck className="w-3 h-3" />
              Garantía hasta {formatDate(installation.warrantyEndDate)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-500" />
              Garantía vencida ({formatDate(installation.warrantyEndDate)})
            </Badge>
          )}
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-2.5">
          <span className="text-[10px] text-muted-foreground block mb-1">Fotos adjuntas ({images.length}):</span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
            {images.map((imgUrl: string, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={() => onImageClick?.(imgUrl)}
                className="relative aspect-square w-16 h-16 rounded-lg overflow-hidden border border-border group shrink-0 hover:opacity-90 transition-opacity"
              >
                <img src={imgUrl} alt="Foto instalación" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Maximize2 className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {installation.id && (
        <div className="mt-3 pt-2 border-t border-border flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 active:scale-95"
            onClick={() => setView("installation-detail", { id: installation.id })}
          >
            <span>Ver ficha de instalación</span>
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// 5. Tarjeta de Cita / Agenda
function AppointmentCard({
  appointment,
  setView,
}: {
  appointment: any;
  setView: (view: any, params?: any, label?: string) => void;
}) {
  const phone = appointment.clientPhone || appointment.phone;
  const cleanPhone = cleanPhoneNumber(phone);
  const waPhone = cleanWaNumber(phone);

  const typeLabels: Record<string, string> = {
    QUOTE_VISIT: "Visita de Presupuesto",
    INSTALLATION: "Instalación",
    MAINTENANCE: "Mantenimiento",
    INCIDENT: "Incidencia",
    OTHER: "Cita",
  };

  return (
    <div className="my-2 rounded-xl border border-primary/20 bg-card p-3 shadow-md transition-all hover:border-primary/40 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <Badge variant="secondary" className="text-[10px]">
              {typeLabels[appointment.type] || appointment.type || "Cita"}
            </Badge>
            <div className="font-semibold text-xs text-foreground mt-0.5">
              {formatDateTime(appointment.startAt)} ({appointment.durationMin || 60} min)
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            appointment.status === "DONE"
              ? "text-emerald-600 border-emerald-500/30"
              : appointment.status === "CANCELLED"
              ? "text-muted-foreground"
              : "text-amber-600 border-amber-500/30"
          }
        >
          {appointment.status === "DONE" ? "Realizada" : appointment.status === "CANCELLED" ? "Cancelada" : "Pendiente"}
        </Badge>
      </div>

      {appointment.clientName && (
        <div className="mt-2 text-xs flex items-center justify-between gap-2 bg-muted/30 p-1.5 rounded">
          <span className="font-medium text-foreground truncate">{appointment.clientName}</span>
          {cleanPhone && (
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={`tel:${cleanPhone}`}
                className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-medium flex items-center gap-1 active:scale-95"
              >
                <PhoneCall className="w-3 h-3" /> Llamar
              </a>
              {waPhone && (
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-[#25D366] text-white text-[10px] font-medium flex items-center gap-1 active:scale-95"
                >
                  <MessageCircle className="w-3 h-3" /> WA
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {appointment.address && (
        <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="truncate">{appointment.address}</span>
        </div>
      )}

      <div className="mt-2.5 pt-2 border-t border-border flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 active:scale-95"
          onClick={() => setView("agenda")}
        >
          <span>Abrir Agenda</span>
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// 6. Tarjeta de Incidencia
function IncidentCard({
  incident,
  setView,
  onImageClick,
}: {
  incident: any;
  setView: (view: any, params?: any, label?: string) => void;
  onImageClick?: (url: string) => void;
}) {
  const images = incident.images || [];

  return (
    <div className="my-2 rounded-xl border border-destructive/30 bg-card p-3 shadow-md transition-all hover:border-destructive/50 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="font-bold text-xs font-mono">{incident.number}</span>
        </div>
        <Badge
          variant={incident.status === "CLOSED" ? "outline" : "destructive"}
          className="text-[10px]"
        >
          {incident.status === "CLOSED" ? "Cerrada" : incident.status === "IN_RESOLUTION" ? "En resolución" : "Abierta"}
        </Badge>
      </div>

      <p className="mt-2 text-xs font-medium text-foreground">{incident.description}</p>

      {incident.clientName && (
        <div className="mt-2 text-xs text-muted-foreground">
          Cliente: <span className="font-medium text-foreground">{incident.clientName}</span>
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
          {images.map((imgUrl: string, idx: number) => (
            <button
              key={idx}
              type="button"
              onClick={() => onImageClick?.(imgUrl)}
              className="relative aspect-square w-14 h-14 rounded-lg overflow-hidden border border-border group shrink-0"
            >
              <img src={imgUrl} alt="Foto incidencia" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>
      )}

      {incident.id && (
        <div className="mt-2.5 pt-2 border-t border-border flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 active:scale-95"
            onClick={() => setView("incident-detail", { id: incident.id })}
          >
            <span>Ver incidencia</span>
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// 7. Tarjeta de Presupuesto
function SaleQuoteCard({
  quote,
  setView,
}: {
  quote: any;
  setView: (view: any, params?: any, label?: string) => void;
}) {
  return (
    <div className="my-2 rounded-xl border border-primary/20 bg-card p-3 shadow-md transition-all hover:border-primary/40 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="font-bold text-xs font-mono">{quote.number}</span>
        </div>
        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
          {quote.status || "BORRADOR"}
        </Badge>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{quote.clientName || "Cliente"}</span>
        <span className="font-bold text-sm text-foreground">{formatCurrency(quote.total)}</span>
      </div>

      {quote.id && (
        <div className="mt-2.5 pt-2 border-t border-border flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 active:scale-95"
            onClick={() => setView("sale-quote-detail", { id: quote.id })}
          >
            <span>Ver presupuesto</span>
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// 8. Tarjeta de Pedido de Venta
function SaleOrderCard({
  order,
  setView,
}: {
  order: any;
  setView: (view: any, params?: any, label?: string) => void;
}) {
  return (
    <div className="my-2 rounded-xl border border-primary/20 bg-card p-3 shadow-md transition-all hover:border-primary/40 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          <span className="font-bold text-xs font-mono">{order.number}</span>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {order.status || "PENDIENTE"}
        </Badge>
      </div>

      <div className="mt-2 text-xs flex items-center justify-between">
        <span className="text-muted-foreground">{order.clientName || "Cliente"}</span>
        {order.paymentStatus && (
          <Badge
            variant={order.paymentStatus === "PAID" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {order.paymentStatus === "PAID" ? "Cobrado" : "Pendiente cobro"}
          </Badge>
        )}
      </div>

      {order.id && (
        <div className="mt-2.5 pt-2 border-t border-border flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 active:scale-95"
            onClick={() => setView("sale-order-detail", { id: order.id })}
          >
            <span>Ver pedido</span>
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Modal Visor de Imágenes (Lightbox)
export function ImageLightboxModal({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/20 hover:bg-white/30 text-white p-2 transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-xl" onClick={(e) => e.stopPropagation()}>
        <img
          src={url}
          alt="Vista ampliada"
          className="w-auto h-auto max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl mx-auto"
        />
      </div>
    </div>
  );
}
