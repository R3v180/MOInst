# Task ID: 2-f — Agenda / Calendario + API

Agent: full-stack-developer
Scope: `src/components/views/agenda-view.tsx` + 4 API routes (appointments + users).

## Files created

**API routes:**
- `src/app/api/users/route.ts` — GET list of active users (`{id, name, email, role}`) ordered by role+name. Used for the "asignado a" filter/select.
- `src/app/api/appointments/route.ts`
  - GET list with filters: `assignedToId`, `startAtFrom`/`startAtTo` (date range), `status`, `clientId`, `type`. Returns items with relations (client, installation, saleOrder, saleQuote, assignedTo).
  - POST create with zod schema: `type`, `startAt`, `durationMin?`, `clientId?`, `installationId?`, `saleOrderId?`, `saleQuoteId?`, `assignedToId?` (defaults to current user), `address?`, `notes?`, `status=PENDING`. Validates FKs; inherits `clientId` from installation if needed.
- `src/app/api/appointments/[id]/route.ts` — GET detail (with all relations), PUT partial (with FK validation), DELETE.
- `src/app/api/appointments/[id]/status/route.ts` — PATCH `{status: PENDING|DONE|CANCELLED}`.

**View:**
- `src/components/views/agenda-view.tsx` — full SPA replacement for the stub. Three view modes (Hoy/Semana/Mes), date navigation, "asignado a" filter, create/edit dialog with client picker + auto-fill address + filtered installation/saleOrder/saleQuote selectors.

## Key decisions

- **Three view modes via Tabs** (Hoy/Semana/Mes), each with prev/next navigation + "back to today/this week/this month" button. Clicking a day in week/month view switches to Hoy mode with that date selected — gives users a natural drill-down UX.
- **Single useQuery** for appointments keyed by `[mode, rangeFrom, rangeTo, assignedToId]` — recomputes date range via `useMemo` based on selected date + mode. Items are bucketed by `YYYY-MM-DD` for week/month grids.
- **TYPE_META map** with `bg-teal`/`bg-amber`/`bg-emerald`/`bg-red`/`bg-muted` (NO blue/indigo) — colored per-type chips + dot indicator on week chips.
- **Address autofill** in the form's `onClientSelect` callback (lint-friendly, no useEffect): when a client is picked, address is overwritten with `fullAddress(client)`. Editable afterwards.
- **Edit dialog uses `key={editing?.id ?? 'new'}`** to force React remount with fresh initial state whenever the target appointment changes — avoids setState-in-effect lint rule entirely. Dialog unmounts content when closed (Radix default), so re-opening "Nueva cita" starts with a fresh form.
- **Filtered selectors**: installation/saleOrder/saleQuote selects are only shown when a client is picked and the client has them — fetches via `/api/installations?clientId`, `/api/sale-orders?clientId`, `/api/sale-quotes?clientId` (queries by other subagents).
- **Status actions** in today list cards (Marcar realizada / Cancelar) AND in edit dialog header — both call PATCH `/api/appointments/[id]/status`. Mutations invalidate `["appointments"]` + `["dashboard"]` query keys.
- **Delete action** in edit dialog footer (only when editing) — DELETE `/api/appointments/[id]`.
- **Google Maps deep-link** in today list cards AND in form preview, using `https://www.google.com/maps/search/?api=1&query=<encoded address>` with `target="_blank" rel="noreferrer"` per the spec.
- **Month grid** built as a 7-column CSS grid with leading/trailing days from neighboring months (muted). Cells show day number + colored chips (per type) + count summary. Clicking day → switches to Hoy mode.
- **Week grid** uses 7 cards (responsive: 1 col mobile → 7 cols on xl). Each card has weekday + date header, count badge, scrollable list of compact chips (`time + client`) sorted by start time. Today's column is highlighted with `ring-2 ring-primary/40`.
- **Mobile-first responsive**: grids `grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7` for week; month grid stays 7-col but cells shrink on mobile (`min-h-[88px] sm:min-h-[112px]`).
- **Client picker** uses `Popover + Command` (shadcn pattern from installations-view) — searchable by name/phone/NIF.
- **Date helpers** are local-timezone-safe (`fmtDateOnly`, `toLocalDateTimeInput`, `fromLocalDateTimeInput`) to avoid UTC offset bugs in datetime-local input.

## Verification

- Dev server test (exact command from task): home=200, /api/appointments=401, /api/users=401, /api/appointments/[id]=401. No compile errors in /tmp/moinst-dev.log.
- `bun run lint`: 0 errors / 0 warnings in my 5 files (4 API routes + agenda-view.tsx). Remaining 3 errors + 1 warning are pre-existing in files outside my scope (page.tsx, attachments/[id]/route.ts, attachment-uploader.tsx).
