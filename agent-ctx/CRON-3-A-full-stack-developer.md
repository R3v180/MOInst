# CRON-3-A — Delete confirmation AlertDialogs in 6 detail views

**Agent:** full-stack-developer
**Date:** 2025
**Task ID:** CRON-3-A
**Scope:** Añadir botón "Eliminar" con AlertDialog de confirmación (shadcn) en 6 vistas detalle, reemplazando el patrón naive window.confirm / mutate directo.

## Archivos modificados (6)
- `src/components/views/client-detail-view.tsx`
- `src/components/views/installation-detail-view.tsx`
- `src/components/views/article-detail-view.tsx`
- `src/components/views/supplier-detail-view.tsx`
- `src/components/views/sale-quote-detail-view.tsx` (solo si status === "DRAFT")
- `src/components/views/incident-detail-view.tsx`

## Patrón aplicado en cada archivo
1. **Import block** — Añadí import de las 10 partes de AlertDialog desde `@/components/ui/alert-dialog`. Si Trash2 no estaba importado, lo añadí al import de lucide-react. Para installation-detail y sale-quote-detail, Trash2 ya estaba importado.
2. **State** — `const [deleteOpen, setDeleteOpen] = useState(false);` junto al resto de estados UI.
3. **Mutation** — `deleteMut = useMutation({ ... })` después de la última mutation existente:
   - `fetch(\`/api/{entidad}/${id}\`, { method: "DELETE" })`
   - Parseo defensivo de error: `const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Error al eliminar")`
   - onSuccess: toast de éxito + `qc.invalidateQueries({ queryKey: ["{entidad-plural}"] })` + `qc.invalidateQueries({ queryKey: ["dashboard"] })` (los counts del sidebar/bell cambian) + `setView("{plural}")`
   - onError: toast destructivo
4. **AlertDialog** — Trigger Button (`variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"`) + AlertDialogContent (title/description/footer con Cancelar + Action `bg-destructive text-destructive-foreground hover:bg-destructive/90` + Loader2 si isPending).

## Decisiones clave
- **Sale-quote condicional**: El AlertDialog completo (trigger + content) se renderiza dentro de `{status === "DRAFT" && (...)}`. Hide en vez de disable (más limpio: no abre un dialog para estados no borrables).
- **Navegación post-delete**: `setView("{plural}")` vuelve al listado correspondiente (clients, installations, articles, suppliers, sale-quotes, incidents).
- **Invalidación de `dashboard`**: Además de la query de lista, invalido `["dashboard"]` porque el sidebar/bell de notificaciones podría mostrar counts que dependen de los registros borrados (p.ej. borrar un cliente con incidencias abre el count de "Incidencias abiertas").
- **AlertDialog completo inline en PageHeader actions**: Radix AlertDialog usa Portal para el content, así que se puede montar el trigger + content dentro del fragment de actions sin problema de layout.
- **No tocar fetch / queries / form dialogs existentes**: solo se añade el botón + AlertDialog + mutation. El Edit Dialog, AddSupplier, AddArticle, Email, Preview, Close, MaintenanceForm, etc. se mantienen intactos.

## Endpoints DELETE usados (todos ya existían)
- DELETE /api/clients/[id]  → route.ts:72
- DELETE /api/installations/[id]  → route.ts:126
- DELETE /api/articles/[id]  → route.ts:114
- DELETE /api/suppliers/[id]  → route.ts:82
- DELETE /api/sale-quotes/[id]  → route.ts:129
- DELETE /api/incidents/[id]  → route.ts:160

## Verificación
- Dev server OK: `curl http://localhost:3000/` → 200. Los 6 views se importan estáticamente desde `app-shell.tsx`, así que cualquier error TS/JSX habría roto la home.
- Sin errores ni warnings en dev log (solo SIGTERM del pkill final).
- `bun run lint` → 0 errores, 0 warnings (exit 0).

## Tope UX nota
Radix AlertDialog cierra el dialog al hacer click en Action (comportamiento default). El `disabled={deleteMut.isPending}` y el spinner Loader2 son decorativos porque el dialog ya está cerrado cuando la mutation pasa a pending. Esto sigue el patrón literal del enunciado. Si en el futuro se quiere mantener el dialog abierto durante la mutation (mostrar progreso), habría que hacer `e.preventDefault()` en onClick y controlar `setDeleteOpen(false)` manualmente en onSuccess. Por ahora, suficiente para 2 socios.
