# Task 2-b — Artículos + Proveedores + histórico de precios con gráfico

Agent: full-stack-developer
Date: 2026-09-24

## Scope
Replaced stubs and created API routes for:
- Articles catalog (list + detail + price history)
- Suppliers catalog (list + detail + association)
- Generic ArticleSupplier creation (always new row to preserve history)

## Files written
**APIs (new)**
- `src/app/api/articles/route.ts` — GET list (q, category, articleType, lowStock) + bestPrice (min across latest-per-supplier) + categories from Setting; POST create with unique-internalCode check
- `src/app/api/articles/[id]/route.ts` — GET detail with supplierPrices + currentPrices (latest per supplier) + bestPrice + recent saleQuoteLines/saleOrderLines; PUT; DELETE
- `src/app/api/articles/[id]/price-history/route.ts` — GET all ArticleSupplier rows for chart (returns rows + supplier list)
- `src/app/api/suppliers/route.ts` — GET list (q) + articlesCount via raw SQL count distinct; POST create
- `src/app/api/suppliers/[id]/route.ts` — GET detail with articlePrices + currentPrices (latest per article) + historyCount; PUT; DELETE
- `src/app/api/suppliers/[id]/articles/route.ts` — POST: associate existing article + price (always new ArticleSupplier row, priceDate=now; retry +1s on unique constraint P2002)
- `src/app/api/article-suppliers/route.ts` — POST: generic create ArticleSupplier row (same retry logic)

**Views (replaced stubs)**
- `src/components/views/articles-view.tsx` — list with q/category/articleType filters, "stock bajo" switch, card grid, bestPrice shown, click → article-detail
- `src/components/views/article-detail-view.tsx` — 3 tabs (Datos, Proveedores y precios, Usado en); prices table with "Best" highlight; price history dialog with recharts LineChart (one line per supplier, checkbox filters) + table; AddSupplierDialog (search existing supplier + price + ref + deliveryDays); edit dialog
- `src/components/views/suppliers-view.tsx` — list with q, card grid showing articlesCount, click → supplier-detail
- `src/components/views/supplier-detail-view.tsx` — 2 tabs (Datos, Artículos); table of all ArticleSupplier rows for this supplier with per-row "Ver histórico" button opening ArticleSupplierHistoryDialog (recharts single-line chart + table); AddArticleDialog with mode "search existing" or "create new" (then auto-associates); edit dialog

## Key decisions
- "Mejor precio actual": per-article, computed via `DISTINCT ON (articleId, supplierId) ... ORDER BY priceDate DESC` raw SQL → in JS take min price across suppliers.
- Price history preservation: ALL `POST /api/article-suppliers` and `POST /api/suppliers/[id]/articles` create new ArticleSupplier rows with `priceDate=now()`. If unique constraint `[articleId,supplierId,priceDate]` clashes (same exact second), retry with +1s.
- Categories: fetched from `Setting.articleCategories` JSON array via `db.setting.findUnique`.
- React Compiler-friendly memoization: `useMemo` deps explicitly listed (no extra closures); supplier-selection uses "off" pattern instead of effect-set-state to satisfy `react-hooks/set-state-in-effect` rule.

## Verification
- `home:200, articles:401, suppliers:401` ✓ (and article-suppliers:405 for GET, all dynamic routes 401/405 as expected)
- `bun run lint` on my files: 0 errors / 0 warnings (the 8 remaining errors are in OTHER files out of scope: sale-quote-detail, sale-order-detail, purchase-quote-detail — pre-existing `react-hooks/set-state-in-effect` in those)
- All endpoints compile via Turbopack and respond with expected status codes.
- Note: pre-existing auth/Prisma env-loading issue in dev server (auth callback fails with "DATABASE_URL must start with postgresql://") — outside my scope (auth.ts/session.ts/db.ts are foundation files I cannot modify). My API routes correctly return 401 for unauthenticated GET and will work once the auth flow succeeds in the user's session.
