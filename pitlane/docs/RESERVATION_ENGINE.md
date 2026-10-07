# Reservation engine — Bloque 3.2

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

El wizard mantiene su diseño, participantes, aceptación temporal y catálogo
visual provisional. Sigue desconectado de la RPC hasta Bloque 4, sin éxito falso
ni localStorage como backend. Su aviso explica que el documento definitivo está
pendiente y que la aceptación del borrador no se registra.

`ReservationPreparation` describe el borrador UI (`waiverAccepted`).
`CreateReservationInput` describe la entrada real (`rulesAccepted`). Los tipos de
respuesta reutilizan `Reservation` de `@/types/database`; amount no son centavos.
`lib/services/reservations.ts` concentra la llamada Supabase y los errores
permitidos; sigue siendo server-only, sin nueva Server Action.

Pagos, Storage, waitlist, second lap, check-in, créditos y reportes quedan fuera
de este bloque. El documento legal definitivo y la conexión UI siguen pendientes.

Contrato SQL, permisos, concurrencia y pruebas:
[RESERVATION_ENGINE_BACKEND.md](RESERVATION_ENGINE_BACKEND.md).
