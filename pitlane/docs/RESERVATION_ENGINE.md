# Reservation engine — Bloques 3.2 y 4

Estado actual: el wizard ya invoca el servicio mediante una Server Action,
solo bajo habilitación explícita de staging. Ver
[RESERVATION_WIZARD_INTEGRATION.md](RESERVATION_WIZARD_INTEGRATION.md).

El schema compartido de main es la autoridad: `20261005155117_schema_base.sql`,
`20261005155549_seed_packages.sql` y `types/database.ts`. No se modifican las
migraciones oficiales ni se recrean sus tablas, funciones, vista o bucket.

Las migraciones antiguas `20261006000000_reservation_catalog.sql` y
`20261006000100_atomic_reservations.sql` fueron retiradas sin haberse desplegado
al compartido. El script `supabase/dev/reservation-catalog.sql` también se retiró:
main ya tiene paquetes oficiales, `supabase/seed.sql` y `docs/demo-data.sql`.
No se ejecutaron seeds ni SQL remoto durante esta reconciliación.

La única migración propia vigente es
`20261006000200_web_reservation_creation.sql`. Extiende reservations con
idempotencia, agrega lectura RLS y creación atómica de reservas y participantes.
`amount` (USD) y `spots` son los snapshots oficiales. No hay snapshots paralelos,
reservation_settings, versión de waiver ni clasificación de entornos en DB.

## Alcance

- Individual: un participante; Friends Combo: cinco. Precio y cupos desde DB.
- Titular: primer participante. No se acepta is_holder del cliente.
- Segunda vuelta existe en el catálogo oficial, pero esta RPC rechaza toda
  elegibilidad distinta de `none`.
- Se exige sesión y correo confirmado en Auth, además de aceptación explícita.
- Hold máximo de 15 minutos, siempre anterior al inicio de tanda.
- Cupos exclusivamente por `slot_available_spots(slot_id)` y lectura pública
  mediante `slot_availability`. No existe una segunda fórmula.

## Booking y servicios

El wizard mantiene su diseño, participantes y aceptación temporal. Lee catálogo
real y disponibilidad oficial por servicios; no utiliza mocks como fallback.
La creación está cerrada por defecto y solo se habilita explícitamente en staging.
El documento definitivo sigue pendiente; la aceptación temporal se registra
únicamente al crear un apartado de prueba, sin presentarse como deslinde oficial.

`ReservationPreparation` describe el borrador UI (`waiverAccepted`).
`CreateReservationInput` describe la entrada real (`rulesAccepted`). Los tipos de
respuesta reutilizan `Reservation` de `@/types/database`; amount no son centavos.
`lib/services/reservations.ts` concentra la llamada Supabase y los errores
permitidos; sigue siendo server-only y lo invoca app/reservar/actions.ts.

Pagos, Storage, waitlist, second lap, check-in, créditos y reportes quedan fuera
de este bloque. El documento legal definitivo y la validación remota en staging
siguen pendientes.

Contrato SQL, permisos, concurrencia y pruebas:
[RESERVATION_ENGINE_BACKEND.md](RESERVATION_ENGINE_BACKEND.md).
