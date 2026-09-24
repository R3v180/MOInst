# CRON-4-A — full-stack-developer — Collapsible sidebar groups with localStorage persistence

## Scope
Only `src/components/app/sidebar-nav.tsx` was modified. No other files touched.

## Implementation summary

The sidebar nav has 5 groups (Principal, Comercial, Operativa, Compras, Sistema) and 15 nav items. Each group header is now a clickable button that toggles collapse state. Collapsed state persists in `localStorage` under `moinst-sidebar-collapsed` (array of group names).

### Key technical decisions

1. **`useSyncExternalStore`** for reading collapsed state from localStorage — avoids hydration mismatch cleanly (SSR uses `getServerSnapshot` returning `[]` to match server HTML; client re-renders with real value after hydration).

2. **Custom event `moinst-sidebar-collapsed-changed`** dispatched on each localStorage write — `useSyncExternalStore`'s subscribe listens to both `storage` (other tabs) and this custom event (same tab), so writes trigger a natural re-render without any `useState`/`useReducer` dispatch. This sidesteps the strict `react-hooks/set-state-in-effect` lint rule entirely.

3. **Module-level snapshot cache** (`cacheRaw`/`cacheValue` keyed on the raw localStorage string) — required by `useSyncExternalStore` because it uses `Object.is` to detect changes; returning a fresh `JSON.parse` array every render would cause infinite re-renders.

4. **Auto-expand on `view` change** — `useEffect([view])` checks if the active view's group is currently collapsed and writes it expanded. Since `writeCollapsed` only dispatches an event (no direct setState), the `set-state-in-effect` rule doesn't fire.

5. **Animation via CSS grid trick** — `grid grid-rows-[0fr]` (collapsed) ↔ `grid-rows-[1fr]` (expanded) with `transition-[grid-template-rows] duration-200`. Child has `overflow-hidden` which makes `min-height: auto` resolve to `0`, letting the row collapse truly to 0. No height measurement needed.

6. **Header button** — `<button type="button">` with `aria-expanded`, `aria-label`, ChevronRight/ChevronDown icons (rotate on hover via `group-hover/header:translate-x-0.5`).

### What was NOT changed
- Nav items: keys, labels, icons, groups — untouched.
- `useQuery(['alerts'])` for low-stock badge — untouched.
- `moinst-nav-active` class on active items — untouched.
- `hover:translate-x-0.5` cue on items — untouched.
- AI button (gradient) and user section (ChevronRight + avatar) — always visible, not collapsible.
- Header (MOInst logo) — not collapsible.

## Files
- `src/components/app/sidebar-nav.tsx` — full rewrite of state mgmt + group rendering.

## Verification
- `bun run lint` → 0 errors, 0 warnings.
- Dev server: `curl http://localhost:3000/` → 200 (compiles clean, 6.0s).
- No Prisma changes — Incident opener remains `createdBy`, SaleOrder has no `total` field used, no `include: { attachments }`, no empty `where: { AND: [] }`.

## Patterns to reuse
- `useSyncExternalStore` + custom event dispatch for client-only persisted state with no hydration mismatch and no `setState-in-effect`.
- CSS grid `grid-rows-[0fr]`/`grid-rows-[1fr]` + child `overflow-hidden` for animated collapse without height measurement.

## Pitfalls hit
- `react-hooks/set-state-in-effect` (eslint-plugin-react-hooks v5+) is strict — disallows even `setMounted(true)` in effect bodies. Solution: avoid `useState` for the persisted state entirely.
- `react-hooks/refs` blocks reading/writing `useRef.current` during render (the old "adjust state during render" pattern with refs no longer works). Solution: moved to `useEffect` + custom-event-based re-render.
- `react-hooks/globals` blocks reassigning module-level variables inside component/hook bodies. Solution: removed manual cache invalidation (`cacheRaw = undefined`) — `readCollapsedSnapshot` auto-invalidates by comparing raw string on every read.
