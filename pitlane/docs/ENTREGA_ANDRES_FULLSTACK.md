# Andrés Montes — Calendario e inventario KRE

Base: `origin/main` en `9bcf6a6`. Rama local: `feature/events-slots-packages`.

## Alcance

- P-03: `/karting/kartingrentalexperience/reservar`: fechas reales, tandas, cinco estados, paquetes vigentes y actualización cada 30 segundos.
- P-06: `/admin/eventos`: crear borradores, editar, generar tandas de 10 minutos con buffer, publicar, cerrar y cancelar; editar capacidad y cupos de pista.
- P-09: `/admin/paquetes`: crear versiones, editar precio y vigencia, activar y desactivar. Nunca se elimina el historial.
- Landing KRE conectada al catálogo real. Servicios separados de los componentes.
- Rutas y acciones protegidas con `requireAdmin()`; RLS para `kre_admin` y `system_admin`.

## Migración nueva

`supabase/migrations/20261005180000_kre_inventory_admin.sql`.

No agrega tablas ni columnas; `schema_base` y `seed_packages` permanecen intactos. Ajusta la restricción de horario para permitir terminar a las 00:00 del día siguiente. Agrega políticas, validaciones, un índice y la RPC `kre_generate_slots`. Se debe comunicar este ajuste al equipo cuando Andrés comparta su trabajo.

La RPC genera todas las tandas en una transacción y rechaza la generación repetida. Los triggers bloquean fechas pasadas, solapamientos, horarios fuera del evento, capacidad superior a 10, reducción que afecte reservas y alteración del horario de una tanda con reservas. Cerrar/cancelar una fecha propaga el estado a sus tandas; las reservas y pagos se conservan. Operación gestiona créditos/reprogramaciones.

Los cupos se consultan exclusivamente desde `slot_availability` / `slot_available_spots()`. La validación administrativa contrasta los cambios de capacidad con esa misma función. El motor de reservas de Gabriel debe bloquear la fila de la tanda al validar y crear reservas atómicamente.

## Integración con Gabriel

`Seleccionar tanda` apunta a `/reservar/[slotId]`. `main` aún no contiene el motor P-04. Se dejó una página de detalle de solo lectura con datos reales, explícitamente sin confirmar reservas. Gabriel puede sustituirla e incorporar su motor. No se tocó `payments.service.ts`.

## Prueba de aceptación

1. Entrar con Andrés y rol `kre_admin`.
2. Crear fecha futura como borrador, por ejemplo 18:00–00:00.
3. Generar con capacidad 10, reserva para pista 2, buffer 0: 36 tandas, 8 cupos web iniciales.
4. Publicar; comprobar la fecha y las tandas desde el calendario público.
5. Editar y desactivar paquetes; comprobar precio y vigencia públicos.
6. Cerrar/cancelar la fecha y verificar los estados; conservar reservas existentes.
7. Probar accesos con piloto; no debe poder administrar.

Pruebas técnicas: `npm run build`, `npm run lint`; ensayo de migración `BEGIN; ... ROLLBACK;` en SQL Editor. Se comprobaron adicionalmente 18 escenarios SQL en PostgreSQL local (PGlite).

La migración se aplicó el 5 de octubre de 2026 en `pitlane-dev` y quedó registrada como `20261005180000` en `supabase_migrations.schema_migrations`. La cuenta de Andrés quedó como `kre_admin`, con autorización del usuario.

Prueba remota completada en SQL Editor con el rol `authenticated` y la identidad de Andrés: crear fecha, generar 36 tandas de 18:00 a medianoche con 2 cupos para pista, publicar, comprobar 8 cupos web por tanda y cancelar las 36 tandas. Todo el ensayo terminó con `ROLLBACK`; no dejó datos de prueba. Se comprobó también el acceso real a `/admin/eventos` desde su sesión del navegador.

Pendiente externo: revisión cruzada de Carlos y el motor de reservas/checkout de Gabriel.
