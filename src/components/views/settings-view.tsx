"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  Database,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Mail,
  CalendarClock,
  FileText,
} from "lucide-react";

type Settings = Record<string, unknown>;

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "SOCIO" | "ADMIN";
  active: boolean;
  createdAt: string;
};

// App version read from package.json (hardcoded here to avoid runtime fs access in client).
const APP_VERSION = "0.2.1";

const DEFAULTS: Settings = {
  articleCategories: [
    "climatización",
    "calderas",
    "termos",
    "repuestos",
    "accesorios",
    "consumibles",
  ],
  installationTypes: ["aire acondicionado", "caldera", "termo", "otro"],
  defaultWarrantyMonths: 24,
  emailTemplateQuote: "",
  emailTemplateWarranty: "",
  emailTemplateAppointment: "",
  companyName: "MOInst",
  lowStockAlerts: true,
};

export function SettingsView() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error("No se pudieron cargar los ajustes");
      return (await r.json()) as Settings;
    },
  });

  return (
    <div>
      <PageHeader
        title="Ajustes"
        description="Usuarios, catálogos, plantillas y sistema"
      />
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="catalogs">Catálogos</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
          <TabsTrigger value="email">Email (SMTP)</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        <TabsContent value="catalogs">
          {isLoading || !settings ? (
            <Loading />
          ) : (
            <CatalogsTab settings={settings} />
          )}
        </TabsContent>

        <TabsContent value="templates">
          {isLoading || !settings ? (
            <Loading />
          ) : (
            <TemplatesTab settings={settings} />
          )}
        </TabsContent>

        <TabsContent value="email">
          <SmtpTab />
        </TabsContent>

        <TabsContent value="system">
          {isLoading || !settings ? (
            <Loading />
          ) : (
            <SystemTab settings={settings} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1 — Usuarios
// ─────────────────────────────────────────────────────────────────────────────

function UsersTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const r = await fetch("/api/users");
      if (!r.ok) throw new Error("No se pudieron cargar los usuarios");
      return (await r.json()) as { items: UserRow[] };
    },
  });
  const items = data?.items ?? [];
  const [showNew, setShowNew] = useState(false);
  // session counter — increments each open so UserForm remounts with fresh state
  const [newKey, setNewKey] = useState(0);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const openNew = () => {
    setNewKey((k) => k + 1);
    setShowNew(true);
  };

  const qc = useQueryClient();

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const r = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al cambiar el estado");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Estado actualizado" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Usuarios
            </h2>
            <p className="text-sm text-muted-foreground">
              Socios y administradores con acceso a MOInst.
            </p>
          </div>
          <Button onClick={openNew} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Nuevo usuario
          </Button>
        </div>

        {isLoading ? (
          <Loading />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sin usuarios.
          </p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.phone ?? "—"}
                    </TableCell>
                    <TableCell>
                      {u.role === "SOCIO" ? (
                        <Badge>SOCIO</Badge>
                      ) : (
                        <Badge variant="secondary">ADMIN</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.active}
                        disabled={toggleMut.isPending}
                        onCheckedChange={(v) =>
                          toggleMut.mutate({ id: u.id, active: v })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(u)}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          De momento solo 2 socios, pero el campo rol existe para el futuro.
        </p>
      </CardContent>

      {/* Dialogo crear */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <UserForm
            key={`new-${newKey}`}
            mode="create"
            onDone={() => setShowNew(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialogo editar */}
      <Dialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
      >
        <DialogContent>
          {editing && (
            <UserForm
              key={editing.id}
              mode="edit"
              user={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UserForm({
  mode,
  user,
  onDone,
}: {
  mode: "create" | "edit";
  user?: UserRow | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  // useState initializers run on mount only. The parent uses `key={editing.id}`
  // for edit and `key={`new-${newKey}`}` for create, so UserForm remounts with
  // fresh state every time the dialog opens. No useEffect needed.
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [role, setRole] = useState<"SOCIO" | "ADMIN">(user?.role ?? "SOCIO");
  const [password, setPassword] = useState("");
  const [resetPw, setResetPw] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim() || null,
        role,
      };
      if (mode === "create") {
        payload.password = password;
      } else if (resetPw && password) {
        payload.password = password;
      }
      const url = mode === "create" ? "/api/users" : `/api/users/${user!.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al guardar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({
        title: mode === "create" ? "Usuario creado" : "Usuario actualizado",
      });
      qc.invalidateQueries({ queryKey: ["users"] });
      onDone();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const needsPassword = mode === "create" || resetPw;
  const passwordOk = !needsPassword || password.length >= 6;
  const canSave = name.trim().length > 0 && email.trim().length > 0 && passwordOk;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Nuevo usuario" : "Editar usuario"}
        </DialogTitle>
        <DialogDescription>
          {mode === "create"
            ? "Crea un nuevo usuario con acceso a MOInst."
            : "Modifica los datos del usuario. Deja la contraseña vacía para no cambiarla."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label>Nombre *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre y apellidos"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Email *</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Teléfono</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 600 000 000"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Rol</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "SOCIO" | "ADMIN")}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SOCIO">SOCIO</SelectItem>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === "create" ? (
          <div>
            <Label>Contraseña *</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="mt-1"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id="resetPw"
                checked={resetPw}
                onCheckedChange={setResetPw}
              />
              <Label htmlFor="resetPw" className="cursor-pointer">
                Restablecer contraseña
              </Label>
            </div>
            {resetPw && (
              <div>
                <Label>Nueva contraseña</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="mt-1"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={() => mut.mutate()} disabled={!canSave || mut.isPending}>
          {mut.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Guardar
        </Button>
      </DialogFooter>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2 — Catálogos
// ─────────────────────────────────────────────────────────────────────────────

function CatalogsTab({ settings }: { settings: Settings }) {
  const qc = useQueryClient();
  const [cats, setCats] = useState<string[]>(
    () =>
      (settings.articleCategories as string[] | undefined) ??
      (DEFAULTS.articleCategories as string[]),
  );
  const [types, setTypes] = useState<string[]>(
    () =>
      (settings.installationTypes as string[] | undefined) ??
      (DEFAULTS.installationTypes as string[]),
  );
  const [months, setMonths] = useState<number>(
    () =>
      Number(
        (settings.defaultWarrantyMonths as number | undefined) ??
          DEFAULTS.defaultWarrantyMonths,
      ),
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleCategories: cats,
          installationTypes: types,
          defaultWarrantyMonths: months,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al guardar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Catálogos guardados" });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-6">
        <EditableList
          title="Categorías de artículos"
          description="Lista de categorías disponibles para clasificar artículos del catálogo."
          items={cats}
          onChange={setCats}
        />
        <EditableList
          title="Tipos de instalación"
          description="Lista de tipos de equipo para las instalaciones."
          items={types}
          onChange={setTypes}
        />
        <div>
          <h3 className="font-medium">Meses de garantía por defecto</h3>
          <p className="text-sm text-muted-foreground mb-2 mt-0.5">
            Nº de meses que se aplicará por defecto al crear una instalación
            nueva.
          </p>
          <Input
            type="number"
            min={1}
            max={120}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value) || 0)}
            className="w-32"
          />
        </div>
        <div className="flex justify-end pt-3 border-t border-border">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar catálogos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditableList({
  title,
  description,
  items,
  onChange,
}: {
  title: string;
  description?: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) {
      toast({
        title: "Ya existe",
        description: `«${v}» ya está en la lista`,
        variant: "destructive",
      });
      return;
    }
    onChange([...items, v]);
    setInput("");
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    onChange(next);
  };

  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-2 mt-0.5">
          {description}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Añadir elemento..."
          className="flex-1"
        />
        <Button type="button" onClick={add} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Añadir
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Lista vacía.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li
              key={`${i}-${it}`}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-background"
            >
              <span className="flex-1 truncate">{it}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Subir"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label="Bajar"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => remove(i)}
                aria-label="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3 — Plantillas
// ─────────────────────────────────────────────────────────────────────────────

function TemplatesTab({ settings }: { settings: Settings }) {
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState<string>(
    () => (settings.companyName as string | undefined) ?? (DEFAULTS.companyName as string),
  );
  const [tplQuote, setTplQuote] = useState<string>(
    () => (settings.emailTemplateQuote as string | undefined) ?? "",
  );
  const [tplWarranty, setTplWarranty] = useState<string>(
    () => (settings.emailTemplateWarranty as string | undefined) ?? "",
  );
  const [tplAppointment, setTplAppointment] = useState<string>(
    () => (settings.emailTemplateAppointment as string | undefined) ?? "",
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          emailTemplateQuote: tplQuote,
          emailTemplateWarranty: tplWarranty,
          emailTemplateAppointment: tplAppointment,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al guardar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Plantillas guardadas" });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-6">
        <div>
          <Label className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" /> Nombre de la empresa
          </Label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="mt-1"
            placeholder="MOInst"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Aparece en los emails y documentos generados.
          </p>
        </div>

        <TemplateEditor
          title="Plantilla de email para presupuesto"
          icon={<FileText className="w-4 h-4 text-muted-foreground" />}
          vars={["{clienteName}", "{quoteNumber}", "{total}", "{companyName}"]}
          value={tplQuote}
          onChange={setTplQuote}
        />

        <TemplateEditor
          title="Plantilla de email de aviso de garantía"
          icon={<ShieldCheck className="w-4 h-4 text-muted-foreground" />}
          vars={[
            "{clienteName}",
            "{equipmentType}",
            "{brandModel}",
            "{warrantyEndDate}",
            "{companyName}",
          ]}
          value={tplWarranty}
          onChange={setTplWarranty}
        />

        <TemplateEditor
          title="Plantilla de email de cita"
          icon={<CalendarClock className="w-4 h-4 text-muted-foreground" />}
          vars={[
            "{clienteName}",
            "{appointmentDate}",
            "{address}",
            "{companyName}",
          ]}
          value={tplAppointment}
          onChange={setTplAppointment}
        />

        <div className="flex justify-end pt-3 border-t border-border">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar plantillas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateEditor({
  title,
  icon,
  vars,
  value,
  onChange,
}: {
  title: string;
  icon?: React.ReactNode;
  vars: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="flex items-center gap-2">
        {icon} {title}
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="mt-1 font-mono text-sm"
        placeholder="Escribe aquí la plantilla..."
      />
      <p className="text-xs text-muted-foreground mt-1.5">
        Variables disponibles:{" "}
        {vars.map((v) => (
          <code
            key={v}
            className="px-1 py-0.5 bg-muted rounded mx-0.5 text-[0.7rem]"
          >
            {v}
          </code>
        ))}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 4 — Sistema
// ─────────────────────────────────────────────────────────────────────────────

function SystemTab({ settings }: { settings: Settings }) {
  const qc = useQueryClient();
  const [lowStock, setLowStock] = useState<boolean>(
    () =>
      (settings.lowStockAlerts as boolean | undefined) ??
      (DEFAULTS.lowStockAlerts as boolean),
  );

  // DB connectivity check: trivial `db.user.count()` server-side via /api/users
  const dbCheck = useQuery({
    queryKey: ["system-db-check"],
    queryFn: async () => {
      const r = await fetch("/api/users");
      return r.ok;
    },
    staleTime: 60_000,
  });
  const dbStatus: "checking" | "ok" | "fail" = dbCheck.isLoading
    ? "checking"
    : dbCheck.data
      ? "ok"
      : "fail";

  const toggleMut = useMutation({
    mutationFn: async (v: boolean) => {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockAlerts: v }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Error al guardar");
      }
      return r.json();
    },
    onMutate: (v) => {
      setLowStock(v);
    },
    onSuccess: () => {
      toast({ title: "Avisos de stock bajo actualizados" });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => {
      // Revert optimistic update on error
      setLowStock((prev) => !prev);
      toast({
        title: "Error",
        description: "No se pudo guardar el ajuste",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard
            label="Versión de la aplicación"
            value={`v${APP_VERSION}`}
          />
          <InfoCard
            label="Base de datos"
            value={
              dbStatus === "checking" ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Comprobando...
                </span>
              ) : dbStatus === "ok" ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-3 py-1 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Conectado a Neon Postgres
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-3 py-1 text-xs font-medium">
                  <XCircle className="w-3.5 h-3.5" />
                  Sin conexión
                </span>
              )
            }
          />
        </div>

        <div className="border border-border rounded-md p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">Avisos de stock bajo</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Activa avisos cuando el stock de un artículo caiga por debajo
                del mínimo. Se mostrará en el dashboard.
              </p>
              <div className="flex items-center gap-2">
                <Switch
                  id="lowStock"
                  checked={lowStock}
                  onCheckedChange={(v) => toggleMut.mutate(v)}
                  disabled={toggleMut.isPending}
                />
                <Label htmlFor="lowStock" className="cursor-pointer text-sm">
                  {lowStock ? "Activados" : "Desactivados"}
                </Label>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-md p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">Copias de seguridad</h3>
              <p className="text-sm text-muted-foreground">
                Neon gestiona las copias de seguridad automáticamente
                (retención por defecto: 7 días punto-en-tiempo).
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-md p-4 bg-background">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function SmtpTab() {
  const qc = useQueryClient();
  const [d, setD] = useState<any>({ host: "", port: 587, secure: false, user: "", password: "", fromEmail: "", fromName: "MOInst" });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: smtpConfig } = useQuery({
    queryKey: ["smtp"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      const data = await r.json();
      return data.smtp ?? null;
    },
  });

  // Cargar config existente cuando llegue
  useEffect(() => {
    if (smtpConfig && !d.host) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setD(smtpConfig);
    }
  }, [smtpConfig]);

  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/email/test", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Error");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Configuración SMTP guardada" });
      qc.invalidateQueries({ queryKey: ["smtp"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testMut = useMutation({
    mutationFn: async () => {
      setTesting(true);
      const r = await fetch("/api/email/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      setTesting(false);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Conexión SMTP correcta", description: "El servidor de email responde correctamente." });
    },
    onError: (e: any) => toast({ title: "Error de conexión", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div>
          <h3 className="font-semibold">Configuración SMTP</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configura tu servidor de email para enviar presupuestos, avisos de cita y notificaciones de garantía directamente desde la app y desde el asistente IA. Si no está configurado, los emails se redactan y se copian al portapapeles.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Servidor SMTP (host)</Label>
            <Input placeholder="smtp.gmail.com" value={d.host ?? ""} onChange={(e) => set("host", e.target.value)} />
          </div>
          <div>
            <Label>Puerto</Label>
            <Input type="number" value={d.port ?? 587} onChange={(e) => set("port", parseInt(e.target.value, 10))} />
          </div>
          <div>
            <Label>Conexión segura (SSL/TLS)</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch checked={!!d.secure} onCheckedChange={(v) => set("secure", v)} />
              <span className="text-xs text-muted-foreground">{d.secure ? "Sí (puerto 465 típico)" : "No (puerto 587 típico, STARTTLS)"}</span>
            </div>
          </div>
          <div>
            <Label>Usuario</Label>
            <Input placeholder="tu@email.com" value={d.user ?? ""} onChange={(e) => set("user", e.target.value)} />
          </div>
          <div>
            <Label>Contraseña</Label>
            <Input type="password" placeholder="••••••••" value={d.password ?? ""} onChange={(e) => set("password", e.target.value)} />
          </div>
          <div>
            <Label>Email remitente</Label>
            <Input type="email" placeholder="envios@tuempresa.com" value={d.fromEmail ?? ""} onChange={(e) => set("fromEmail", e.target.value)} />
          </div>
          <div>
            <Label>Nombre remitente</Label>
            <Input placeholder="MOInst" value={d.fromName ?? ""} onChange={(e) => set("fromName", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={() => saveMut.mutate(d)} disabled={saving || !d.host || !d.user || !d.fromEmail}>
            <Save className="w-4 h-4 mr-2" /> Guardar
          </Button>
          <Button variant="outline" onClick={() => testMut.mutate()} disabled={testing || !d.host || !d.user}>
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Probar conexión
          </Button>
        </div>
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <div className="font-medium text-foreground">Ejemplos comunes:</div>
          <div>• Gmail: host smtp.gmail.com, puerto 587, secure=false, user=tu@gmail.com, password=contraseña de aplicación</div>
          <div>• Mailgun: host smtp.mailgun.org, puerto 587, secure=false</div>
          <div>• Office365: host smtp.office365.com, puerto 587, secure=false</div>
          <div>• Resend: host smtp.resend.com, puerto 465, secure=true, user=resend</div>
        </div>
      </CardContent>
    </Card>
  );
}
