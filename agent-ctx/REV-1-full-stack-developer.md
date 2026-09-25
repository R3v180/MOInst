# Task REV-1 — full-stack-developer

**Task:** Dashboard mini-gráfico ventas mensuales + widget stock bajo + badge sidebar + vista mantenimientos con filtros.

## Work Log

- Leí `worklog.md` (315 líneas) y los archivos de referencia: `schema.prisma` (Maintenance, Article, SaleOrder), `dashboard/route.ts`, `dashboard-view.tsx`, `sidebar-nav.tsx`, `app-store.ts`, `app-shell.tsx`, `incidents-view.tsx` (patrón de filtros), `installations/[id]/maintenances/route.ts`, `installations/[id]/route.ts`, `format.ts`, `page-header.tsx`, `empty-state.tsx`, `article-detail-view.tsx` (patrón recharts), `globals.css` (vars chart-1..5).
- **Feature A1** (`/api/dashboard/route.ts`): añadidos `monthlySales` y `lowStockArticles` a la respuesta. Se traen los `SaleOrder` con `status in [INSTALLED, CLOSED]` y `issueDate >= now-5meses`, se agrupan en JS por mes (índice 0..5 = mes actual -5..0) usando `monthIdx()`. Para stock bajo, Prisma no soporta comparar dos columnas en `where`, así que se traen los artículos con `stockMin > 0` y se filtran en JS (`a.stock <= a.stockMin`), tomando los 10 con `stock` más bajo.
- **Feature A2** (`dashboard-view.tsx`): nuevo bloque entre los KPI y los cards existentes — `lg:grid-cols-3` con:
  - Card "Ventas mensuales (6 meses)" (`lg:col-span-2`) con `recharts BarChart` (XAxis por `month`, YAxis con `tickFormatter` "k" para miles, Tooltip personalizado `MonthlySalesTooltip` que muestra mes + total con `formatCurrency` + count de pedidos; `Cell` con paleta `var(--color-chart-1..5)`; altura 200px responsive).
  - Card "Stock bajo" con lista scroll (`max-h-96 overflow-y-auto scroll-thin`) de artículos, cada fila `name + internalCode·category + stock en rojo / mín + "Reponer"`. Si vacío: "Sin avisos de stock".
  - Limpieza de imports: eliminado `AlertTriangle` (sin uso), añadidos `PackageX`, `Package`, `TrendingUp`.
- **Feature B1** (`/api/alerts/route.ts`): nuevo GET que devuelve `{ lowStockCount, openIncidentsCount, pendingQuotesCount, expiringWarrantiesCount }` usando 3 `count()` de Prisma + 1 `findMany` para stock bajo (filtrado en JS, mismo truco que en dashboard).
- **Feature B2** (`sidebar-nav.tsx`): añadido `useQuery(['alerts'])` con `staleTime: 60_000` y `refetchOnMount: false`. Si `lowStock > 0`, se renderiza un `<span>` badge rojo (`bg-destructive text-destructive-foreground`, `min-w-[18px] h-[18px]`) después del label "Artículos" en el sidebar. Sutil, con `title` accesible.
- **Feature C1** (`/api/maintenances/route.ts`): nuevo GET con filtros `installationId`, `clientId` (vía `installation.clientId`), `dateFrom/dateTo` (sobre `date`), `performedById`. Paginación `page`/`pageSize` (default 25, máx 100). Cada item incluye `installation` (con `client`) y `performedBy`. Guard `if (where.AND.length === 0) delete where.AND` para evitar el Prisma error con `AND: []` vacío.
- **Feature C2** (`maintenances-view.tsx`): vista completa con `PageHeader`, filtros (cliente Select cargado de `/api/clients?pageSize=200`, rango fechas dateFrom/dateTo, realizado por Select cargado de `/api/users`), botón "Limpiar filtros" cuando hay filtros activos, tabla (Table de shadcn) con columnas Fecha / Cliente / Instalación (brand+model o equipmentType con icon Wrench) / Próxima revisión / Notas / Realizado por. Click en fila → `setView("installation-detail", { id: m.installationId })`. Paginación Anterior/Siguiente si >1 página. `EmptyState` con mensaje contextual (filtros activos vs sin datos).
- **Feature C3**: añadido `"maintenances"` al `ViewKey` union en `app-store.ts`. Añadido `import { MaintenancesView }` + case `"maintenances"` en `app-shell.tsx`. Añadido `{ key: "maintenances", label: "Mantenimientos", icon: WrenchIcon, group: "Operativa" }` después de Incidencias en `sidebar-nav.tsx` (reusando `Wrench as WrenchIcon` ya que `Wrench` ya estaba cogido para Instalaciones).
- Verificación dev server (comando exacto del enunciado): home=200, dashboard=401, alerts=401, maintenances=401. Sin errores de compilación en `/tmp/moinst-dev.log` (sólo las 5 líneas esperadas del log de peticiones).
- `bun run lint`: 0 errores, 0 warnings (output `eslint .` limpia).

## Stage Summary

- **Archivos modificados (4):**
  - `src/app/api/dashboard/route.ts` — añadidos `monthlySales` + `lowStockArticles` a la respuesta.
  - `src/components/views/dashboard-view.tsx` — añadido bloque chart + low-stock card, nuevos imports recharts.
  - `src/components/app/sidebar-nav.tsx` — añadido badge stock bajo en Artículos + useQuery alerts + nuevo item nav Mantenimientos.
  - `src/store/app-store.ts` — añadido `"maintenances"` al `ViewKey`.
  - `src/components/app/app-shell.tsx` — añadido import + case `maintenances`.
- **Archivos creados (3):**
  - `src/app/api/alerts/route.ts` — GET con 4 counts.
  - `src/app/api/maintenances/route.ts` — GET con filtros + paginación.
  - `src/components/views/maintenances-view.tsx` — vista completa con filtros + tabla + paginación.
- **Decisiones clave:**
  - Prisma no permite comparar dos columnas en `where` (e.g. `stock <= stockMin`); se traen los candidatos con `stockMin > 0` y se filtran en JS, tomando `slice(0, 10)` con `orderBy stock asc` para priorizar los más críticos.
  - `monthlySales` se agrupa en JS a partir de un `findMany` de los SaleOrder de los últimos 6 meses (`status in [INSTALLED, CLOSED]`); el índice `monthIdx()` usa la diferencia de meses (año*12+mes) respecto al actual para localizar el slot correcto en el array `[0..5]`.
  - El badge de stock bajo en el sidebar es sutil: rojo `destructive`, 18px alto, número centrado, con `title` accesible. `useQuery(['alerts'])` con `staleTime: 60s` + `refetchOnMount: false` para no recargar en cada navegación interna.
  - La vista de Mantenimientos reutiliza `/api/users` (ya existente del agente 2-f) y `/api/clients` (ya existente del foundation) para poblar los selects de filtros — no se crean endpoints redundantes.
  - Click en una fila de mantenimiento navega a `installation-detail` (no existe maintenance-detail) — mantiene coherencia con el flujo de instalación que es donde se crean/editan mantenimientos.
  - Guard `if (where.AND.length === 0) delete where.AND` en `/api/maintenances` para evitar el Prisma error con arrays vacíos (siguiendo el contexto del bug fix).
- **Verificación:** dev server OK (200/401/401/401, sin errores compile). `bun run lint`: 0 errores en los 8 archivos tocados (5 modificados + 3 creados).
