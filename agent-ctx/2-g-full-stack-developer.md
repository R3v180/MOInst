# Task 2-g — Ajustes (settings) module

**Agent:** full-stack-developer
**Task ID:** 2-g
**Scope:** `src/components/views/settings-view.tsx` + `src/app/api/settings/route.ts` + `src/app/api/users/route.ts` + `src/app/api/users/[id]/route.ts`

## What was built

### API routes

**`/api/settings`** (`src/app/api/settings/route.ts`)
- `GET` — returns all Setting rows as a plain `{ key: value }` object. 401 if unauthenticated.
- `PUT` — body is `{ key: value, ... }` map (validated with `z.record(z.string(), z.unknown())`). Upserts each setting via `db.setting.upsert(...)`. Returns the new map. Requires auth.

**`/api/users`** (`src/app/api/users/route.ts`)
- `GET` — returns `{ items: [...] }` with fields `{ id, name, email, phone, role, active, createdAt }`, ordered by createdAt asc.
- `POST` — creates a user. Zod schema requires `name`, valid `email`, optional `phone` (nullable), `role` ∈ {SOCIO, ADMIN} (default SOCIO), `password` ≥ 6 chars. Email is lowercased+trimmed; uniqueness is checked (400 if duplicate). Password is hashed with `bcrypt.hash(pw, 10)`. Returns the new user (sans `passwordHash`).

**`/api/users/[id]`** (`src/app/api/users/[id]/route.ts`)
- `GET` — single user (without `passwordHash`).
- `PUT` — partial update: `name`, `email`, `phone`, `role`, `active`, optional `password` (≥6 chars). When password provided, it's hashed. Email change re-checks uniqueness (excluding self).
- `PATCH` — toggles `active` via `{ active: boolean }` body.

### View

`src/components/views/settings-view.tsx` — replaced the `StubView` placeholder with a full 4-tab implementation:

1. **Usuarios** — `useQuery(['users'])` → table of all users with name/email/phone/role badge (SOCIO=primary, ADMIN=secondary)/active Switch (PATCH `/api/users/:id`)/"Editar" button. "Nuevo usuario" button opens a Dialog with the `UserForm` (name/email/phone/role/password). Edit dialog reuses the same `UserForm` in `mode="edit"` with a `key={editing.id}` to force remount on user switch + an optional "Restablecer contraseña" toggle. Inline note: "De momento solo 2 socios, pero el campo rol existe para el futuro".

2. **Catálogos** — three editable blocks:
   - `EditableList` for `articleCategories` (default climatización/calderas/termos/repuestos/accesorios/consumibles) — input + "Añadir" (Enter key supported), per-row Up/Down/Trash buttons, dedupe check.
   - `EditableList` for `installationTypes` (default aire acondicionado/caldera/termo/otro).
   - Number input for `defaultWarrantyMonths` (default 24, 1–120 range).
   - "Guardar catálogos" button → `PUT /api/settings` with the three keys.

3. **Plantillas** — textareas for:
   - `emailTemplateQuote` (vars `{clienteName}`, `{quoteNumber}`, `{total}`, `{companyName}`).
   - `emailTemplateWarranty` (vars `{clienteName}`, `{equipmentType}`, `{brandModel}`, `{warrantyEndDate}`, `{companyName}`).
   - `emailTemplateAppointment` (vars `{clienteName}`, `{appointmentDate}`, `{address}`, `{companyName}`).
   - Plain input for `companyName`.
   - "Guardar plantillas" button → bulk `PUT /api/settings`.

4. **Sistema** — InfoCards for app version (`v0.2.1`) and DB status badge. DB check uses `useQuery(['system-db-check'])` that hits `GET /api/users` and shows ✓ "Conectado a Neon Postgres" (emerald) / ✗ "Sin conexión" (red) / spinner while loading. Switch for `lowStockAlerts` (immediate upsert via `PUT /api/settings`, optimistic update). Note about Neon backup policy (7-day PITR).

## Decisions

- **Form-state sync without useEffect**: used the `key`-prop remount pattern (`key={editing.id}` for edit, `key={`new-${newKey}`}` with a session counter for create). `useState` initializers read from props at mount time. No `useEffect`, no `eslint-disable` comments. Lint-clean.
- **Optimistic lowStock toggle**: `onMutate` sets local state immediately, `onError` reverts by toggling back. Toast on success/error.
- **`z.record(z.string(), z.unknown())`** for PUT /api/settings body — accepts any key/value map, since Setting.value is Json.
- **DB connectivity probe** reuses `/api/users` instead of a new endpoint (avoids scope creep). 60s stale time to avoid hammering it.
- **`value as never`** casts on Prisma `upsert` calls — satisfies TS strict typing on the Json field.
- **Password validation**: ≥6 chars (matches the API zod schema). Email is lowercased+trimmed before sending.
- **bcryptjs** already in package.json (`^3.0.3`), used in `auth.ts` — same `bcrypt.hash(pw, 10)` rounds.

## Verification

Dev server test:
```
home:           200
settings:       401   (no session)
users:          401
users/[id]:     401
```
No compile errors in `/tmp/moinst-dev.log`. All four routes built with Turbopack cleanly.

`bun run lint` — 0 errors, 0 warnings on my 4 files. The remaining 2 errors + 1 warning are pre-existing in `src/app/page.tsx`, `src/app/api/attachments/[id]/route.ts`, and `src/components/shared/attachment-uploader.tsx` (all outside my scope).
