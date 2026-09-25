# Task 2-e — Incidencias con trazabilidad completa + API

**Agent:** full-stack-developer
**Scope:** 4 rutas API + 2 vistas (reemplazando stubs).

## Archivos creados

- `src/app/api/incidents/route.ts` — GET list (filtros status/clientId/q, paginación, incluye client/installation/saleOrder/openedBy/closedBy/_count.attachments) + POST create (zod valida clientId required, installationId/saleOrderId opcionales con validación de coherencia cliente, number = `INC-AAAA-NNNN` via `nextSequential('incident','INC')`, status=OPEN, openedAt=now, openedById=user.id).
- `src/app/api/incidents/[id]/route.ts` — GET detalle con **cadena de trazabilidad completa anidada** (client, installation con `sourceSaleOrder` que a su vez incluye `purchaseQuotes`+supplier y `purchaseOrders`+supplier+`albaranes`+attachments, saleOrder directo si lo hay con la misma estructura, attachments INCIDENT, openedBy, closedBy); PUT description/resolution/status (con lógica de re-apertura: si CLOSED→OPEN/IN_RESOLUTION, limpia closedAt/closedById); DELETE con cleanup de archivos en disco.
- `src/app/api/incidents/[id]/close/route.ts` — POST {resolution}. Bloquea si ya CLOSED. Setea status=CLOSED, closedAt=now, closedById=user.id, resolution.
- `src/app/api/incidents/[id]/attachments/route.ts` — GET polimórfico entityType=INCIDENT, verifica 404 de la incidencia.

## Vistas

- `src/components/views/incidents-view.tsx` — listado con filtros (q por número/descripción/cliente, status OPEN/IN_RESOLUTION/CLOSED, cliente), grid de tarjetas responsive (md:2, xl:3) mostrando number (font-mono teal), cliente, descripción (line-clamp-2), chip de instalación con brand/model/serial, badge de estado, fecha de apertura/cierre, contador de adjuntos. Diálogo "Nueva incidencia": cliente buscable (Popover+Command), instalación filtrada por cliente (GET /api/installations?clientId=X), descripción textarea. Botón "Abrir incidencia".
- `src/components/views/incident-detail-view.tsx` (la pieza clave del spec):
  - PageHeader back to "incidents", título = number, actions: Editar, Cerrar incidencia (sólo si no CLOSED), AttachmentUploader compact (entityType=INCIDENT).
  - Layout 2 columnas en desktop:
    - **Izquierda**: Card de detalle (status badge, openedAt+openedBy, closedAt+closedBy, descripción, resolución si CLOSED), links a client-detail e installation-detail con brand/model/serial mostrados.
    - **Card de Trazabilidad completa** (la feature estrella): `<ol>` vertical con 7 niveles, cada uno con icono+label+fila de chips clickables o "—" disabled. Los chips son botones que llaman `setView` con el viewKey y id correctos:
      1. Incidencia (actual, chip teal sólido)
      2. Instalación → installation-detail
      3. Pedido de venta → sale-order-detail (prioriza el directo de la incidencia, si no el heredado de la instalación; hint diferencia ambos casos)
      4. Presupuestos de compra → purchase-quote-detail (un chip por PQ, con total como sublabel)
      5. Pedidos de compra → purchase-order-detail (un chip por PO, supplier como sublabel)
      6. Albaranes de entrada → purchase-order-detail (cada albarán linkea a su PO)
      7. Proveedores → supplier-detail (deduplicados por id)
    - **Derecha**: Card "Fotos adjuntas" con AttachmentUploader default + grid de AttachmentThumb (onDelete).
  - Diálogo "Cerrar incidencia": resolution textarea (obligatoria) → POST /close → toast + refresh.
  - Diálogo "Editar": description + resolution (PUT), con nota de que para cerrar hay que usar el botón dedicado.

## Decisiones clave

- **Una sola petición** para construir la cadena de trazabilidad: el GET /api/incidents/[id] devuelve la cadena completamente anidada (installation.sourceSaleOrder.purchaseQuotes/purchaseOrders con supplier y albaranes), sin necesidad de fetches encadenados desde el frontend.
- Reuse del `saleOrderTraceInclude` entre `installation.sourceSaleOrder` y `saleOrder` directo, para que la cadena funcione igual si la incidencia tiene installationId o saleOrderId o ambos.
- En la PUT, lógica de **re-apertura**: si la incidencia estaba CLOSED y se cambia a OPEN/IN_RESOLUTION, se limpian closedAt/closedById y (si OPEN) se borra resolution. Esto permite "reabrir" una incidencia cerrada por error sin dejar basura de cierre.
- DELETE con cleanup de archivos físicos en disco (mismo patrón que installations/[id]/route.ts).
- Al crear incidencia desde `installations/[id]` no había contexto pasado por params; el nuevo diálogo permite buscar cliente y filtrar instalaciones. Si el usuario no vincula instalación, la incidencia queda "huérfana" (installationId=null) — válido por schema.
- El breadcrumb de trazabilidad maneja los 3 orígenes del saleOrder: directo (incident.saleOrder), heredado de instalación (installation.sourceSaleOrder), o ninguno — chips disabled con "—" en cualquier nivel sin datos.

## Verificación

- Dev server: `home: 200`, `GET /api/incidents: 401`, `GET /api/incidents/[id]: 401`, `GET /api/incidents/[id]/attachments: 401`. Sin errores de compilación en `/tmp/moinst-dev.log`.
- `bun run lint`: 0 errores en mis 6 archivos. Los 3 errores restantes son preexistentes en archivos fuera de mi scope (`page.tsx`, `attachments/[id]/route.ts`, `attachment-uploader.tsx`).
