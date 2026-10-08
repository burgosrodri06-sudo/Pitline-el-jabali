# Supabase en PitLane

> Para la integración final, prevalece [FINAL_INTEGRATION_STATUS.md](FINAL_INTEGRATION_STATUS.md): historial remoto pendiente de verificar, diez migraciones, cupos vendidos conservados tras asistencia y gate de staging. La carga validada de comprobantes incorpora una excepción server-only de service-role que requiere coordinación; nunca una clave pública ni un cambio de RLS para permitir subidas sin validar. Los comandos remotos de esta guía no se ejecutaron durante integración.

Guía corta para que todo el equipo use Supabase igual. Todo se corre dentro de `pitlane/`.

## 1. Configuración local

1. Copia `.env.example` a `.env.local` y pega los valores (pídelos al equipo o sácalos de Supabase → Project Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # la publishable/anon key
   ```
2. `npm install`
3. `npm run dev -- --webpack`

`.env.local` nunca se commitea (ya está en `.gitignore`).
**Nunca uses la secret key (service_role)** en el código ni en `.env.local`.

## 2. Clientes de Supabase

```ts
// Server Components, Server Actions, Route Handlers
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Client Components ("use client")
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

## 3. Usuario actual (`lib/auth`)

Solo en el servidor:

```ts
import { getCurrentUser, requireAuthenticatedUser, requireVerifiedUser } from "@/lib/auth";

const user = await getCurrentUser();            // User | null
const user = await requireAuthenticatedUser();  // si no hay sesión → /login?next=<ruta actual>
const user = await requireVerifiedUser();       // si el correo no está verificado → /verificar-correo
```

Siempre `supabase.auth.getUser()`, **nunca** `getSession()` en el servidor.

`proxy.ts` refresca la sesión en cada request y manda a `/login?next=<ruta>` si entras sin sesión a `/perfil`, `/mis-reservas`, `/reservas`, `/admin`, `/staff` o `/cobros`. El calendario (`/karting/kartingrentalexperience/reservar` y `/reservar/[slotId]`) es público. El proxy solo revisa que haya sesión; el rol se revisa en cada página con `requireRole()`.

## 4. Base de datos: siempre con migraciones

**Nunca crees ni cambies tablas a mano en el dashboard.** Todo cambio va como migración en `supabase/migrations/`.

1. Crea la migración:
   ```
   npx supabase migration new nombre_descriptivo
   ```
2. Escribe el SQL en el archivo nuevo. Toda tabla nueva lleva `enable row level security` y sus políticas.
3. Súbela en tu PR. Las migraciones se aplican con:
   ```
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```
   o automáticamente si el repo está conectado a Supabase (integración de GitHub).

Nunca edites una migración que ya se aplicó; crea una nueva.

## 5. Roles y permisos

`profiles.role` tiene uno de estos 5 valores (tipo `UserRole` en `@/types`). Todo registro nuevo es `pilot`.

| Rol | Quién es |
|---|---|
| `pilot` | Cliente que reserva |
| `staff` | Personal de pista |
| `payments` | Verifica cobros |
| `kre_admin` | Administra KRE |
| `system_admin` | Administra todo el sistema |

**Acceso por sección:**

| Sección | Roles |
|---|---|
| `/admin/eventos`, `/admin/paquetes` | `kre_admin`, `system_admin` |
| `/admin/reportes` | `kre_admin`, `system_admin`, `payments` |
| `/staff/*` | `staff`, `kre_admin`, `system_admin` |
| `/cobros/*` | `payments`, `system_admin` |

Para cambiar el rol de alguien: en el SQL Editor de Supabase, o desde la app con una cuenta `system_admin`. Nadie puede cambiar su propio rol.

**En páginas** (Server Components):

```ts
import { requireRole, requireAdmin } from "@/lib/auth";

const { user, profile } = await requireRole("payments", "system_admin"); // sin sesión → /login?next=...; sin el rol → /
const { user, profile } = await requireAdmin(); // igual que requireRole("kre_admin", "system_admin")
```

**Inicio de cada rol** (a dónde va después del login si no hay `?next=`):

```ts
import { getHomeForRole } from "@/lib/auth/home"; // también se exporta desde "@/lib/auth" (solo servidor)

getHomeForRole("pilot");    // /reservar
getHomeForRole("staff");    // /staff/check-in
getHomeForRole("payments"); // /cobros/verificacion
getHomeForRole("kre_admin"); // /admin/eventos (igual system_admin)
```

**En políticas RLS** usa `public.has_role(array[...])`, que devuelve `true` si el usuario actual tiene alguno de esos roles. También existe `public.get_my_role()`, que devuelve el rol del usuario actual.

```sql
create policy "Personal y admins leen todas las reservas"
  on public.reservas for select
  to authenticated
  using ((select public.has_role(array['staff', 'kre_admin', 'system_admin'])));
```

## Tablas actuales

El schema base (`*_schema_base.sql`) está congelado: todas las tablas y nombres ya existen, con RLS activado. Solo trae lectura pública del calendario (eventos `open`, sus tandas y paquetes activos); **cada dueño agrega las políticas de sus tablas en una migración nueva en su rama**. Tipos TypeScript en `@/types/database`.

| Tablas | Dueño |
|---|---|
| `profiles` | Carlos |
| `events`, `slots`, `packages` | Andrés |
| `reservations`, `reservation_participants`, `waitlist_entries` | Gabriel |
| `payments` | Gabriel y Rodrigo |
| `attendance`, `credits` | Rodrigo |
| Reportes (`services/reports.service.ts`) | Rodrigo |
| `notifications`, `audit_logs` | integración |

**Cupos disponibles:** se leen **solo** de la vista `public.slot_availability` (`slot_id`, `available_spots`), que usa `public.slot_available_spots(slot_id)`. Nunca calcules cupos en el código. Fórmula: `capacity - track_reserved_spots - spots` de reservas en `payment_review` o `paid`, o en `pending_payment` con `expires_at > now()`.

Los comprobantes de transferencia van al bucket privado de Storage `payment-receipts`.

**Datos:** los 3 paquetes llegan con la migración `seed_packages` (también al remoto). `supabase/seed.sql` solo corre en local con `npx supabase db reset` y crea un evento de prueba; para tenerlo en el remoto, pega `docs/demo-data.sql` en el SQL Editor.

- `public.profiles`: `id`, `full_name`, `phone`, `role` (ver roles arriba, default `pilot`), `created_at`. Se crea sola al registrarse (toma `full_name` y `phone` de los metadatos del signup). Cada usuario lee y edita su propio perfil; `staff`, `payments`, `kre_admin` y `system_admin` leen todos; solo `system_admin` edita perfiles de otros y cambia roles.
