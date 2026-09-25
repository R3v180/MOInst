# Task 2-d: Presupuestos de compra + Pedidos de compra + Albaranes

## Scope
- 5 views: purchase-quotes-view, purchase-quote-detail-view, purchase-orders-view, purchase-order-detail-view, albaranes-view
- API routes:
  - /api/purchase-quotes (GET list, POST create) — filters: supplierId, saleOrderId, status, q, includeMeta
  - /api/purchase-quotes/[id] (GET, PUT, DELETE)
  - /api/purchase-quotes/[id]/status (PATCH {status})
  - /api/purchase-quotes/[id]/generate-order (POST — creates PurchaseOrder with nextSequential('purchaseOrder','PDC'))
  - /api/purchase-orders (GET list with filters)
  - /api/purchase-orders/[id] (GET detail, PUT)
  - /api/albaranes (GET list, POST create)
  - /api/albaranes/[id] (GET detail, DELETE)
  - /api/albaranes/[id]/attachments (GET polymorphic list)

## Infra added (required for AttachmentUploader to work)
- Created `/api/attachments/route.ts` (POST + GET polymorphic) — was missing from prior agents. Uploads to `/home/z/my-project/upload/{entityType}/`. Used by AttachmentUploader for entityType=PURCHASE_QUOTE / ALBARAN / PURCHASE_ORDER.
- Added `randomId` helper to `src/lib/utils.ts`.

## Conventions
- All API routes use `getCurrentUser` for GETs and `requireUser` for write operations (consistent with existing /api/clients).
- Use `nextSequential("purchaseOrder","PDC")` for purchase order numbering (e.g. PDC-2026-0001).
- Status enums used directly (no validation mapping).
- Lines subtotal = quantity * unitPrice, rounded to 2 decimals (no discount on purchase side).
- includeMeta=1 query param returns suppliers + saleOrders lists for the list views to populate dropdowns.
- All views use `'use client'`, useQuery/useMutation, toast from `@/hooks/use-toast`, PageHeader/EmptyState/StatusBadge.
- `set-state-in-effect` lint rule triggered for initial form sync; silenced with `eslint-disable-next-line` (same pattern as existing sale-quote-detail-view).

## Verification
- home: 200, purchase-quotes: 401, purchase-orders: 401, albaranes: 401 — all good.
- Lint: 0 errors in my files (remaining lint errors in src/app/page.tsx are not in my scope).
