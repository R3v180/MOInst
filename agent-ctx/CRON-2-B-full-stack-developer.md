# Task ID: CRON-2-B — Loading skeletons for list views

**Agent:** full-stack-developer
**Scope:** Replace the "Cargando..." spinner branch in 11 list views with skeleton grids/rows that match each view's existing layout.

## Work Log

- Leí `worklog.md` (sección CRON-REVIEW-1 + convenciones) y `src/components/ui/skeleton.tsx` (componente Skeleton ya existente, `bg-accent animate-pulse rounded-md`).
- Revisé los 11 view files para entender el layout exacto de cada lista (grid columns, card shape, columnas de tabla).
- Apliqué el patrón de skeleton en cada vista — sólo se reemplazó la rama `isLoading` del ternario; nada de filtros, fetch ni render de listas fue tocado.

## Archivos modificados (11)

### Grid de cards (6 placeholders cada uno)

1. `src/components/views/clients-view.tsx` — grid `md:grid-cols-2 xl:grid-cols-3`, card p-4 con avatar 9x9 + nombre/NIF + 3 líneas (phone/email/city) + footer de contadores.
2. `src/components/views/installations-view.tsx` — grid `sm:grid-cols-2 xl:grid-cols-3`, card p-4 flex-col gap-3: header (title+sub+badge), chip de tipo, 3 líneas, footer garantía+incidencias.
3. `src/components/views/articles-view.tsx` — grid `md:grid-cols-2 xl:grid-cols-3`, card p-4: header (name+code+badge+category), brand, footer stock+price.
4. `src/components/views/suppliers-view.tsx` — grid `md:grid-cols-2 xl:grid-cols-3`, card p-4: avatar + name/contact + 3 líneas + footer.
5. `src/components/views/albaranes-view.tsx` — grid `md:grid-cols-2 xl:grid-cols-3`, card p-4: badge+date header, 2 líneas, notes, footer foto+usuario.
6. `src/components/views/incidents-view.tsx` — grid `md:grid-cols-2 xl:grid-cols-3`, card p-4 flex-col gap-3: number+client+badge, 2 líneas descripción, chip equipo, footer fecha+attach.

### Tabla con filas skeleton (5 placeholders cada uno)

7. `src/components/views/sale-quotes-view.tsx` — `<Card><CardContent p-0>` con `divide-y divide-border` y max-h-[70vh]; 6 columnas skeletonizadas (Número, Cliente+sub, Emisión md, Válido hasta lg, Total, Estado badge).
8. `src/components/views/sale-orders-view.tsx` — mismo patrón; 6 columnas (Número, Cliente+sub, Emisión md, Estado badge, Pago badge, Incidencias lg).
9. `src/components/views/purchase-quotes-view.tsx` — Card + overflow-x-auto + min-w-[700px]; 6 columnas (Fecha, Proveedor, Pedido venta [chip+texto], Total, Estado badge, Pedidos count).
10. `src/components/views/purchase-orders-view.tsx` — Card + overflow-x-auto + min-w-[800px]; 7 columnas (Número mono, Proveedor, Pedido venta, Fecha, Total, Estado badge, Albaranes count).
11. `src/components/views/maintenances-view.tsx` — Card + divide-y; 6 columnas (Fecha primary, Cliente, Instalación [wrench+label], Próxima rev, Notas, Realizado por).

## Decisiones

- **Patrón uniforme para grids**: `<Card><CardContent className="p-4">…skeleton…</CardContent></Card>` envuelto en `[...Array(6)].map` para coincidir con la card real que ya usa cada vista.
- **Patrón uniforme para tablas**: en vez del `border border-border rounded-md divide-y` sugerido en el enunciado, se reutilizó `<Card><CardContent className="p-0">` + `<div className="divide-y divide-border">` para que visualmente el skeleton ocupe exactamente la misma superficie que la tabla real (mismos bordes redondeados, mismo fondo, misma sombra). Las `min-w-[Npx]` en los overflow-x-auto garantizan que las filas no colapsen en móvil.
- **Anchos de columnas**: cada `Skeleton` usa `w-*` aproximado al contenido real (números cortos 20–24, nombre 32–36, badges 16 con `rounded-full`, fechas 24, etc.).
- **`shrink-0` y `flex-1`**: en skeletons circulares (avatars) y en la columna "Cliente" de las tablas (que en la tabla real tiene dos líneas: nombre + ciudad/sub-texto).
- **Responsive**: `hidden md:block` y `hidden lg:block` en los skeletons de columnas que en la tabla real también están ocultas en mobile (Emisión/Válido hasta en sale-quotes, Emisión en sale-orders, Incidencias en sale-orders). Así el skeleton respeta los mismos breakpoints.
- **Limpieza de imports**: tras eliminar el `<Loader2 className="animate-spin" /> Cargando...` de la rama `isLoading` en 3 vistas read-only (sale-orders, purchase-orders, maintenances), `Loader2` quedó sin uso y se eliminó del import para evitar warnings de lint. En las 8 vistas restantes, `Loader2` sigue usándose en los botones de los diálogos/forms, así que se mantuvo el import.

## Verificación

- Dev server (`pkill -f 'next dev'; sleep 1; setsid bun run dev …; sleep 16; curl /`): `home:200`, sin errores de compilación en `/tmp/moinst-dev.log`. Tail limpio.
- `bun run lint`: 0 errores, 0 warnings.
- No se tocaron filtros, queries, mutations, fetch, ni la lógica del EmptyState. Sólo se reemplazó la rama `isLoading` del ternario.

## Stage Summary

- 11 vistas con skeleton loaders consistentes con su layout existente (6 cards grid para las vistas de cards, 5 filas para las vistas de tabla).
- Cada skeleton imita la estructura del card/tabla real (mismas columnas, mismos breakpoints responsive, misma jerarquía visual).
- Dev server OK, lint OK.
