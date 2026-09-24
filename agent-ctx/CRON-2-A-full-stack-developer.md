# Task ID: CRON-2-A — Dark mode toggle + Global notifications bell

**Agent:** full-stack-developer
**Scope:** ThemeProvider enableSystem + manual dark/light toggle in topbar + global notifications bell (Popover + 4 categories from `/api/alerts`).

## Work Log

### Context review
- Read `worklog.md` (CRON-REVIEW-1 + REV-1 sections): confirmed `/api/alerts` endpoint already returns `{ lowStockCount, openIncidentsCount, pendingQuotesCount, expiringWarrantiesCount }` (added in REV-1). No backend extension needed.
- Read `src/components/providers.tsx`, `src/components/app/topbar.tsx`, `src/components/ui/popover.tsx`, `src/store/app-store.ts`, `src/app/globals.css` (`.dark` block at line 82 confirmed).

### Files modified

**1. `src/components/providers.tsx`** — changed `enableSystem={false}` → `enableSystem={true}` so next-themes honors OS preference (`prefers-color-scheme`) while still allowing manual `setTheme("light"|"dark")` overrides from the toggle. `defaultTheme="light"` remains the fallback when OS preference can't be determined. `disableTransitionOnChange` keeps the snap switch.

**2. `src/components/app/notifications-bell.tsx` (NEW)** — `'use client'` component:
- `useQuery(['alerts'])` with `staleTime: 60_000`, `refetchOnMount: false` (mirrors the sidebar's existing `['alerts']` query — both clients share the cache entry, no duplicate network calls).
- Trigger: ghost icon `Button` with `Bell` from lucide-react. When `total > 0` a red badge (`bg-destructive text-destructive-foreground`, 18px tall, min-w 18px, rounded-full, `ring-2 ring-background` for crisp edge against topbar) is rendered absolute top-right. Shows `99+` if > 99.
- `Popover` (align="end", sideOffset=6, w-72, p-0) lists the 4 categories:
  1. Stock bajo (Package) → `setView("articles")`
  2. Garantías a caducar (ShieldAlert) → `setView("installations")`
  3. Presupuestos sin respuesta (FileText) → `setView("sale-quotes")`
  4. Incidencias abiertas (Siren) → `setView("incidents")`
- Each row: icon chip (red tint when count>0, muted when 0), label (truncate), pill count. Disabled (`opacity-50 cursor-default`) when count is 0 to avoid dead-end navigation; only clickable rows navigate.
- Empty state: "Sin avisos" centered. Loading: "Cargando avisos...".
- Click handler closes the popover then calls `useAppStore.getState().setView(v)` (per task instructions — avoids a hook subscription that would re-render when other state in `app-store` changes).

**3. `src/components/app/topbar.tsx`** — added `ThemeToggle` (inline `function` component in the same file) and wired `NotificationsBell` into the Actions cluster:
- Imports: added `Sun, Moon` from lucide-react, `useTheme` from `next-themes`, `NotificationsBell` from `./notifications-bell`.
- `ThemeToggle`:
  - Hydration-safe pattern: `useState(false)` `mounted` + `useEffect` that calls `setMounted(true)` once on mount. Until mounted, renders a stable `disabled` placeholder `Button` (with `Sun` icon, `aria-hidden`, `tabIndex={-1}`) so the SSR'd HTML matches the first client render — no hydration mismatch.
  - `// eslint-disable-next-line react-hooks/set-state-in-effect` placed INSIDE the effect body, immediately before the `setMounted(true)` line (NOT above `useEffect(...)` — that location triggers a "Unused eslint-disable directive" warning since the rule fires on the call-site line, not the hook-call line).
  - Uses `resolvedTheme ?? theme` to decide the icon: with `enableSystem={true}`, the user's `theme` can be `"system"`, but `resolvedTheme` gives the actually-applied ("light"|"dark") — so the icon always reflects what's on screen, and the toggle flips to the opposite explicit value (`setTheme(isDark ? "light" : "dark")`), pinning a manual choice (no oscillation around "system").
  - Icon shown: `Sun` when dark (click → light), `Moon` when light (click → dark).
  - `title` and `aria-label` in Spanish.
  - `className="hidden md:flex"` to hide on small screens (mobile menu + search already compete for space).
- Topbar Actions cluster order: `IA` button → `ThemeToggle` → `NotificationsBell` → `LogOut`.

### Lint fix iteration
- First lint pass: error `react-hooks/set-state-in-effect` at line 47 + warning "Unused eslint-disable directive". Cause: disable was on the line ABOVE the `useEffect(...)` call, but the rule fires on the `setMounted(true)` line inside the body. Fix: moved the disable INSIDE the effect, just above the offending `setState` call. Re-lint: 0 problems.

### Dev server verification
- Single bash command per task instructions (sandbox kills processes between commands):
  ```
  pkill -f 'next dev'; sleep 1; setsid bash -c 'cd /home/z/my-project && bun run dev' ... & sleep 16; <tests>; pkill -f 'next dev'
  ```
- Results: `home: 200`, `alerts: 401` (expected — 401 because the curl isn't authenticated; the route works when called from the SPA after NextAuth session is active, as the sidebar badge already demonstrated in REV-1).
- Compile log: clean, no PrismaClientValidationError, no TypeErrors. `GET /` 6.2s initial compile then 37ms cached.

## Stage Summary
- **Files modified (2):** `src/components/providers.tsx`, `src/components/app/topbar.tsx`.
- **Files created (1):** `src/components/app/notifications-bell.tsx`.
- **Backend:** No API changes needed — `/api/alerts` already returned all 4 counts since REV-1.
- **Decisions:**
  - `enableSystem={true}` + `defaultTheme="light"` so OS pref is respected but light is the safe default when unspecified.
  - Toggle uses `resolvedTheme` (not raw `theme`) for the icon to handle the "system" mode where `theme === "system"`.
  - NotificationsBell uses `useAppStore.getState().setView(v)` (no hook subscription) per the task convention; this also means the bell re-renders only when its own `useQuery(['alerts'])` data changes.
  - The `['alerts']` query cache is SHARED between sidebar badge (REV-1) and the bell — same `queryKey`, same `staleTime`. Two components, one network call.
  - Items with count=0 are visually de-emphasized and disabled (no dead clicks). Empty state has its own row inside the popover body.
- **Verification:** dev server 200/401 (home/auth) — expected. `bun run lint`: 0 errors, 0 warnings.
- **Scope respected:** only the 3 files in scope (providers.tsx, topbar.tsx, notifications-bell.tsx) were touched. The `/api/alerts/route.ts` was already complete from REV-1 (verified, not modified).
