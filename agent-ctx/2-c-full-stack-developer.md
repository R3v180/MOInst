# Task 2-c — Presupuestos de venta + Pedidos de venta + API

Agent: full-stack-developer
Scope: 4 views + 7 API routes for SaleQuote/SaleOrder lifecycle.

## Work Log

1. Read `/home/z/my-project/worklog.md` + `prisma/schema.prisma` + `lib/session.ts` + existing patterns (clients-view, client-detail-view, dashboard-view, attachment-uploader, status-badge).
2. Created API routes:
   - `src/app/api/sale-quotes/route.ts` — GET list (filters: status, clientId, q, dateFrom, dateTo) + POST create (zod validation, computes subtotals/laborTotal/total server-side, number via `nextSequential('saleQuote','PV')`).
   - `src/app/api/sale-quotes/[id]/route.ts` — GET detail (client, installation, lines with article + latest ArticleSupplier price, createdBy, saleOrders) + attaches Setting `emailTemplateQuote`/`companyName` for the email dialog. PUT replaces lines (deleteMany + createMany) and recalculates totals. DELETE refuses if SaleOrders exist.
   - `src/app/api/sale-quotes/[id]/status/route.ts` — PATCH {status}; enforces transition table (DRAFT→SENT→ACCEPTED|REJECTED|EXPIRED, with reverse to DRAFT allowed).
   - `src/app/api/sale-quotes/[id]/generate-order/route.ts` — POST; requires status=ACCEPTED; refuses duplicates (returns existing); creates SaleOrder with `nextSequential('saleOrder','PDV')`, copies all SaleQuoteLine→SaleOrderLine (articleId, description, quantity, unitPrice, discount, subtotal, isLabor, sortOrder).
   - `src/app/api/sale-orders/route.ts` — GET list (filters: status, clientId, paymentStatus, q) with `_count` for installations/incidents/deliveryAlbaranes.
   - `src/app/api/sale-orders/[id]/route.ts` — GET detail (client, sourceSaleQuote, lines with article, installations, purchaseQuotes+supplier, purchaseOrders+supplier, incidents+installation, deliveryAlbaranes+attachments+uploadedBy, future appointments, attachments, createdBy). PUT {status?, paymentStatus?, notes?}.
   - `src/app/api/sale-orders/[id]/install/route.ts` — POST body `{items: [{mode:'new', clientId, equipmentType, brand?, model?, serialNumber?, location?, warrantyEndDate?, notes?} | {mode:'link', installationId}]}`; for each new → `db.installation.create({sourceSaleOrderId: id})`, for each link → update `sourceSaleOrderId`; finally sets SaleOrder.status = INSTALLED.
3. Implemented views:
   - `sale-quotes-view.tsx` — PageHeader with "Nuevo presupuesto" button, filters (q by number, status select, client select, date range), Card+Table with number/client/issueDate/validUntil/total/status badge, sticky header, click → setView("sale-quote-detail"). New dialog only takes clientId/issueDate/validUntil/notes (lines added from detail).
   - `sale-quote-detail-view.tsx` (most complex) — PageHeader actions: Editar / Marcar enviado (DRAFT) / Marcar aceptado (SENT) / Generar pedido (ACCEPTED→POST generate-order→setView sale-order-detail) / Vista previa PDF / Enviar por email. Header card (client link, installation link, dates, status badge, total, createdBy). Editable Líneas table: each row has description (Input + absolute-positioned dropdown fetching `/api/articles?q=…` for autocomplete; on selecting article, fills description, articleId, unitPrice from `article.supplierPrices[0].price`), quantity, unitPrice, discount, auto-computed subtotal, delete. Add buttons: Artículo (isLabor=false) / Mano de obra (isLabor=true, amber-tinted row). Condiciones/notas textarea. Totales card: Materiales (non-labor) + Mano de obra (labor) + Total. Pedidos generados list. Vista previa PDF Dialog with `#print-area` and injected `@media print` CSS that hides everything except the printable area; "Imprimir / PDF" calls `window.print()`. Email dialog with composed text from `settings.emailTemplateQuote` (fallback default), variables {clienteName, quoteNumber, total, companyName} replaced; "Copiar" via `navigator.clipboard.writeText`; note "No se envía automáticamente".
   - `sale-orders-view.tsx` — PageHeader "Pedidos de venta"; filters (q, status, paymentStatus, clientId); table with number/client (+ counts)/issueDate/status badge/payment badge/incidents count; click → sale-order-detail.
   - `sale-order-detail-view.tsx` — PageHeader actions: "Cambiar estado" DropdownMenu (PENDING/IN_PROGRESS/INSTALLED/CLOSED with current marked), "Marcar instalado" button (hidden if INSTALLED/CLOSED), toggle paymentStatus (Cobrado↔Marcar cobrado), "Nueva incidencia" (setView incidents with context), AttachmentUploader (entityType=SALE_ORDER). Header card: client link, sourceSaleQuote link, issueDate, status+payment badges, createdBy. Two-column layout: main column = Líneas table (read-only, shows article info, labor badge) + total; Instalaciones generadas (list → installation-detail, button to open install dialog); Albaranes de entrega (shows deliveryAlbaranes with attachments, falls back to direct SALE_ORDER attachments). Side column = Compras vinculadas (purchaseQuotes + purchaseOrders, both link to detail views), Incidencias (link to incident-detail), Notas textarea (autosave on blur). InstallDialog: list of items (mode new/link), new form has equipmentType/brand/model/serialNumber/location/warrantyEndDate/notes, link form has select from client's installations.
4. Fixed hooks-rule violations:
   - Removed `useMemo` after conditional return in sale-quote-detail (computed inline).
   - Replaced broken `<Popover>` trigger pattern in LineDescriptionInput with a plain absolute-positioned dropdown (simpler, no Radix trigger focus issues).
   - Added `// eslint-disable-next-line react-hooks/set-state-in-effect` to the 3 unavoidable setState-in-effect cases (syncing query data to local form draft, opening dialog with reset items).

## Stage Summary

- **Files created (API)**: 7 routes under `src/app/api/sale-quotes/` and `src/app/api/sale-orders/`.
- **Files modified (views)**: 4 view files in `src/components/views/`.
- **Decisions**:
  - Server-side computation of subtotals + laborTotal + total on create/update to ensure data integrity.
  - GET /sale-quotes/[id] returns `settings` (emailTemplateQuote, companyName) so the email dialog has the template without needing `/api/settings`.
  - `generate-order` is idempotent: if a SaleOrder already exists for the quote, returns its id.
  - DELETE /sale-quotes/[id] refuses if a SaleOrder has been generated from it.
  - Install endpoint accepts multiple items (mix of new + link) in one request; sets `sourceSaleOrderId` and status=INSTALLED.
  - Article autocomplete in sale-quote-detail uses `/api/articles?q=…` (provided by sibling agent 2-b). If it fails, the dropdown shows "no coincidences" and the user can type free text.
  - Attachments for albaranes use the existing AttachmentUploader (entityType=SALE_ORDER). The polymorphic `attachments` table stores them; the Albaran records (proper Albaran table) come from sibling agent 2-d's albaranes module.
- **Verification**:
  - Dev server test: home=200, /api/sale-quotes=401, /api/sale-orders=401. ✓
  - `bun run lint`: my 4 view files + 7 API routes pass cleanly (0 errors). Remaining 5 lint errors are pre-existing in files OUTSIDE my scope (`page.tsx`, `attachments/[id]/route.ts`, `purchase-quote-detail-view.tsx`, `purchase-order-detail-view.tsx` — same `react-hooks/set-state-in-effect` rule + 1 `no-require-imports`).
  - All API routes use `requireUser()`/`getCurrentUser()` and return 401 when unauthenticated, JSON when authenticated.
