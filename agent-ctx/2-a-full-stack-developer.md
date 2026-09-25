# Task 2-a — Instalaciones module (full-stack-developer)

> Worklog context for downstream agents: read `/home/z/my-project/worklog.md` for global conventions.
> This file is my own work record for Task ID `2-a`.

## Scope delivered
- 2 view files: `installations-view.tsx`, `installation-detail-view.tsx`
- 5 API route files under `src/app/api/installations/...`

## API surface

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/installations?q=&equipmentType=&status=&clientId=&page=&pageSize=` | `getCurrentUser` | returns `{items,total,page,pageSize,meta:{installationTypes,defaultWarrantyMonths}}` |
| POST | `/api/installations` | `requireUser` | zod validates: clientId, equipmentType required; installDate/warrantyEndDate coerced to Date; validates client + sourceSaleOrderId exist |
| GET | `/api/installations/[id]` | `getCurrentUser` | includes client, sourceSaleOrder (+client), attachments, incidents, maintenances (+performedBy.name), saleQuotes, createdBy |
| PUT | `/api/installations/[id]` | `requireUser` | partial update with same zod schema; verifies client/saleOrder FKs if changed |
| DELETE | `/api/installations/[id]` | `requireUser` | removes polymorphic Attachment rows + disk files, then installation |
| GET | `/api/installations/[id]/attachments` | `getCurrentUser` | verifies installation exists; returns `{items}` for entityType=INSTALLATION |
| POST | `/api/installations/[id]/maintenances` | `requireUser` | zod: date required, nextReviewDate+notes optional; performedById = user.id |
| DELETE | `/api/installations/[id]/maintenances/[mid]` | `requireUser` | checks mid belongs to installationId |

## Key design decisions

1. **Settings pulled into `meta`** of GET /api/installations — avoids having to create a separate `/api/settings` endpoint (outside scope). The list view uses `meta.installationTypes` to populate the equipmentType dropdown and `meta.defaultWarrantyMonths` to suggest the warranty end date when the user picks the install date.

2. **Searchable client picker** built with Popover + Command (cmdk). Fetches `/api/clients?pageSize=100&q=` lazily (only when dialog open).

3. **Warranty end date suggestion** computed in an onChange handler of the install date input (not via useEffect), to avoid `react-hooks/set-state-in-effect` lint error.

4. **Pagination reset on filter change** done by wrapping `setEquipmentType`/`setStatus` setters in an `onFilterChange` helper that also calls `setPage(1)` — not via useEffect, for the same lint reason.

5. **MaintenanceForm reset** done via React `key` prop change (`key={`maint-${showMaint}`}`) instead of useEffect, also for lint cleanliness.

6. **Detail view installation types**: small `useQuery` to `/api/installations?pageSize=1` to fetch `meta.installationTypes` for the edit dialog's equipmentType select. Cheap and dedup'd by react-query.

7. **Polymorphic attachments**: list comes from GET `/api/installations/[id]` (embedded in installation object) AND from GET `/api/installations/[id]/attachments` (separate, used for refetch-after-upload via `refetchAtts`).

8. **DELETE side-effect**: removes attachments from disk + DB before deleting the installation. Uses ESM imports (`fs/promises`, `path`) — not `require()` — to satisfy `@typescript-eslint/no-require-imports`.

## Verification
- `bun run lint` — no errors/warnings in my 7 files. Remaining lint errors are in other agents' files (page.tsx, sale-quote-detail-view, sale-order-detail-view, attachment-uploader, attachments/[id]/route.ts, etc.) — out of scope.
- Dev server (Next.js 16 Turbopack):
  - `GET /` → 200 (home renders)
  - `GET /api/installations` → 401 (no auth, expected)
  - `GET /api/installations/<any-id>` → 401 (no auth, expected)
  - No compile errors in dev.log

## Cross-module integration points (for downstream agents)
- This module writes to: `Installation`, `Maintenance`, `Attachment` (entityType=INSTALLATION).
- Reads from: `Client`, `SaleOrder` (via `sourceSaleOrderId` relation "InstallationFromSaleOrder"), `Incident`, `SaleQuote`, `Setting` (keys `installationTypes`, `defaultWarrantyMonths`).
- Navigation calls emitted by these views: `setView("client-detail", {id})`, `setView("sale-order-detail", {id})`, `setView("incident-detail", {id})`, `setView("sale-quote-detail", {id})`, `setView("incidents")` (for "Nueva incidencia"). All those views must exist in `app-shell.tsx` (they do, as stubs or will be implemented by other agents).
- Attachment upload relies on the shared `POST /api/attachments` endpoint (already present).
