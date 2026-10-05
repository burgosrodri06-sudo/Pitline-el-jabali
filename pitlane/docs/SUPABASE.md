# Supabase en PitLane

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
const user = await requireAuthenticatedUser();  // si no hay sesión → /login
const user = await requireVerifiedUser();       // si el correo no está verificado → /verificar-correo
```

Siempre `supabase.auth.getUser()`, **nunca** `getSession()` en el servidor.

`proxy.ts` refresca la sesión en cada request y manda a `/login?next=<ruta>` si entras sin sesión a `/perfil`, `/dashboard` o `/admin`. `/reservar` es pública.

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

## 5. Administradores

Un admin es un usuario con `role = 'admin'` en `public.profiles`. Para hacer admin a alguien, cambia su `role` en el Table Editor de Supabase (desde la app nadie puede cambiar su propio `role`).

**En páginas** (Server Components):

```ts
import { requireAdmin } from "@/lib/auth";

const { user, profile } = await requireAdmin(); // sin sesión → /login; si no es admin → /
```

**En políticas RLS** usa `public.is_admin()`, que devuelve `true` si el usuario actual es admin:

```sql
create policy "Los admins leen todas las reservas"
  on public.reservas for select
  to authenticated
  using ((select public.is_admin()));
```

## Tablas actuales

- `public.profiles`: `id`, `full_name`, `phone`, `role` (`cliente` | `admin`), `created_at`. Se crea sola al registrarse (toma `full_name` y `phone` de los metadatos del signup). Cada usuario solo lee y edita su perfil y no puede cambiar su `role`.
