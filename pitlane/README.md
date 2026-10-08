# PitLane · El Jabalí

PitLane es la aplicación web de reservas de karting del Autódromo El Jabalí (El Salvador). Por ahora cubre la experiencia **KRE (Karting Rental Experience)**: el piloto consulta fechas y tandas publicadas, crea su cuenta, reserva y sube el comprobante de su transferencia; el equipo administra fechas, tandas y paquetes.

Está hecha con Next.js 16 (App Router), React, Tailwind CSS y Supabase (Auth, Postgres con RLS y Storage).

## Cómo correrlo

Todo se corre dentro de `pitlane/`.

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env.local` y completa los valores como explica [docs/SUPABASE.md](docs/SUPABASE.md). Las reservas y los comprobantes quedan deshabilitados salvo en un proyecto de staging aparte.
3. Levanta el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   y abre [http://localhost:3000](http://localhost:3000). Si tienes problemas con Turbopack, usa `npm run dev -- --webpack`.

Otros comandos:

| Comando | Qué hace |
| --- | --- |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Revisión de tipos |
| `npx next build --webpack` | Build de producción |
| `npm test` | Pruebas de check-in y reservas (`node --test`) |

## Rutas principales

| Ruta | Pantalla |
| --- | --- |
| `/` | Redirige a la landing de KRE |
| `/karting/kartingrentalexperience` | Landing de KRE |
| `/karting/kartingrentalexperience/reservar` | Calendario: fechas, tandas y paquetes |
| `/reservar` | Wizard de reserva |
| `/reservas/[id]/pago` | Subida del comprobante de pago |
| `/login`, `/registro`, `/verificar-correo`, `/recuperar-contrasena`, `/nueva-contrasena`, `/perfil` | Cuenta del piloto |
| `/admin/eventos`, `/admin/paquetes` | Administración de fechas, tandas y paquetes |

## Estructura de carpetas

```
pitlane/
├── app/                 Rutas (App Router)
│   ├── (auth)/          Login, registro, verificación, contraseña y perfil
│   ├── karting/         Landing y calendario de KRE
│   ├── reservar/        Wizard de reserva
│   ├── reservas/        Pago de una reserva
│   ├── admin/           Administración de inventario KRE
│   └── api/             Route Handlers (comprobantes de pago)
├── components/
│   ├── layout/          SiteHeader y UserMenu
│   ├── auth/            Fuentes y piezas de UI de auth
│   └── kre/             Componentes de la landing, el calendario y el inventario
├── domain/              Reglas de negocio sin UI (eventos y reservas)
├── services/            Acceso a datos por módulo (auth, catálogo, inventario, reservas…)
├── lib/
│   ├── supabase/        Clientes de Supabase para servidor y navegador
│   ├── auth/            Usuario actual, roles y rutas de inicio
│   └── services/        Servicios del motor de reservas y pagos
├── modules/check-in/    Lógica de check-in
├── supabase/            Migraciones, seed y pruebas SQL
├── tests/               Pruebas con node --test
├── types/               Tipos compartidos y de la base de datos
├── docs/                Documentación de cada módulo
└── proxy.ts             Refresca la sesión y protege rutas privadas
```

## Documentación por módulo

- **Supabase, auth y migraciones:** [docs/SUPABASE.md](docs/SUPABASE.md)
- **Landing y calendario KRE:** [docs/KRE_ANDRES.md](docs/KRE_ANDRES.md), [docs/ENTREGA_ANDRES_FULLSTACK.md](docs/ENTREGA_ANDRES_FULLSTACK.md), [docs/PR_KRE_ANDRES.md](docs/PR_KRE_ANDRES.md)
- **Motor de reservas:** [docs/RESERVATION_ENGINE.md](docs/RESERVATION_ENGINE.md), [docs/RESERVATION_ENGINE_BACKEND.md](docs/RESERVATION_ENGINE_BACKEND.md)
- **Wizard de reserva:** [docs/RESERVATION_WIZARD_INTEGRATION.md](docs/RESERVATION_WIZARD_INTEGRATION.md)
- **Comprobantes de pago:** [docs/PAYMENT_RECEIPT_UPLOAD.md](docs/PAYMENT_RECEIPT_UPLOAD.md)
- **Datos de demostración:** [docs/demo-data.sql](docs/demo-data.sql)
