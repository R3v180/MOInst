# CRON-3-B — Dashboard recent activity feed + styling polish

Agent: full-stack-developer
Scope: 6 files ONLY (per task constraint).

## Files modified
- `src/app/api/dashboard/route.ts` — added recentActivity field
- `src/components/views/dashboard-view.tsx` — added "Actividad reciente" card
- `src/components/shared/empty-state.tsx` — polished empty state (gradient, larger icon, max-width description)
- `src/components/app/topbar.tsx` — wrapped theme/bell/logout with shadcn Tooltip
- `src/app/globals.css` — enhanced .moinst-card-hover with border-color shift + box-shadow
- `src/components/app/sidebar-nav.tsx` — user row now clickable to settings, hover bg-sidebar-accent

## Key decisions
- recentActivity = latest 3 of each (client, saleQuote, saleOrder, incident, installation) ordered by createdAt desc, merged in JS, sorted by createdAt desc, take 8. type is `client|saleQuote|saleOrder|incident|installation|appointment` (appointment is in the union for completeness but NOT fetched).
- For incidents we use `createdAt` (when the record was created in the system); `openedAt` is also available but createdAt aligns better with the "what happened recently" timeline intent.
- Activity timeline UI: clickable rows with left border accent per type (teal/amber/emerald/red/purple), small icon per type, label + sublabel + formatRelative + StatusBadge for items with status. Max-height 320px with scroll-thin scrollbar.
- EmptyState: replaced `bg-muted` icon container with `w-16 h-16 rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10` (larger, accent-colored). Added `bg-gradient-to-br from-primary/[0.04] via-transparent to-amber-500/[0.04]` gradient + a soft halo behind the icon. Bumped description max-width to `max-w-md`.
- Tooltip implementation: Tooltip component already wraps TooltipProvider internally (per src/components/ui/tooltip.tsx). Three separate `<Tooltip>` instances, each with its own provider.
- ThemeToggle wraps its Button with Tooltip INTERNALLY (in the function body), not externally at the call site — because ThemeToggle is a plain function component (not forwardRef), wrapping externally with TooltipTrigger asChild would warn "Function components cannot be given refs". By inlining the Tooltip inside ThemeToggle, the asChild child is the shadcn Button (forwardRef) and refs work correctly.
- NotificationsBell (external component) wrapped with `<Tooltip><TooltipTrigger asChild><span className="inline-flex"><NotificationsBell/></span></TooltipTrigger>...</Tooltip>` — the span wrapper is a DOM element that accepts refs natively via Slot.cloneElement.
- .moinst-card-hover:hover now adds `border-color: color-mix(in oklch, var(--primary) 30%, var(--border))` and a primary-tinted box-shadow (`0 4px 12px -2px color-mix(in oklch, var(--primary) 18%, transparent)`). color-mix used to layer primary over the existing border color (so it works in both light and dark themes).
- Sidebar user row: button with `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`, ChevronRight icon on the right with `group-hover:translate-x-0.5` motion cue. Avatar bg inverts on hover (bg-sidebar-accent → bg-sidebar) for a "highlight" effect.

## Verification
- Dev server: home=200, dashboard=401 (401 expected — curl without auth; the route works post-login as previously demonstrated).
- `bun run lint`: 0 errors, 0 warnings.
- No Prisma errors: used `select` with nested relation selects (no `include: { attachments }`); no `where: { AND: [] }` empty anywhere; Incident uses `createdBy` relation (not `openedBy`); SaleOrder has no `total` field queried.
