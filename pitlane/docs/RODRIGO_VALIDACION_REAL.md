# Cierre de la entrega de Rodrigo

## Corrección del hallazgo de capacidad de Andrés

El informe `REVISION_PR14_RODRIGO.md` detectó una reducción indebida de 10 a 8
cupos con diez vendidos. Se reprodujo con una prueba que fallaba antes del arreglo.
La migración nueva `20261008003300_align_operations_capacity_guard.sql` comparte
el cálculo de disponibilidad con la validación administrativa de la propuesta.
Ahora se rechaza la reducción; pasan 92 pruebas y 9 carreras concurrentes,
incluyendo la venta web/pista contra edición de capacidad en ambos órdenes.
La secuencia de migraciones del remoto informada en el reporte se validó en una
base local desechable. No se aplicó SQL al remoto ni se da por aprobada la revisión
de Andrés: debe comprobar el nuevo commit del PR.

## Actualización tras integrar main `b35cbea`

El catálogo de Andrés, las rutas de tanda/pago y la conexión del wizard de Gabriel
ya están en main e incorporados a la rama de Rodrigo. Los hallazgos G-01/G-02/G-03
y el calendario ausente descritos abajo son el registro histórico de `c6c5047`;
ya no deben interpretarse como rutas ausentes en el código actual. Falta su
validación remota autenticada. Pasan 86 pruebas combinadas y 5 escenarios de
concurrencia con todas las migraciones; los resultados remotos de abajo no se han
revalidado durante esta resolución de conflictos.

## Registro de la revisión anterior

Estado al 7 de octubre de 2026, código `34cddb5`, main `c6c5047`, PR #14.
Este documento registra lo comprobado y el procedimiento pendiente. No equivale
a una aprobación de Andrés ni a una prueba completada en el teléfono de pista.

## Evidencia obtenida

| Comprobación | Resultado |
| --- | --- |
| Suites de reservas y operaciones sobre todas las migraciones | 67 pruebas aprobadas |
| Concurrencia en PostgreSQL local | 5 escenarios aprobados; web usa `create_reservation` real |
| Lint y build de producción con TypeScript | Aprobados |
| Cinco páginas de Rodrigo, visual a 360/1440 px | Aprobadas con fixtures, no sesión remota |
| Cinco rutas de Rodrigo sin sesión, navegador sobre build real | Todas redirigen a `/login` |
| Supabase remoto: Auth y lectura pública de paquetes | HTTP 200; tres paquetes oficiales presentes |
| Supabase remoto: `operation_slot_closures`, consulta sin filas | HTTP 404 / PGRST205: tabla ausente del schema cache |
| Supabase remoto: columna `reservations.idempotency_key`, consulta sin filas | HTTP 400 / 42703: columna ausente |
| Acceso de la CLI a Supabase | `AccessTokenRequiredError`; no hay sesión de administración |

Las comprobaciones remotas usaron únicamente la clave pública, sin leer reservas
ni datos personales, y no crearon ni modificaron registros. Los resultados de
Auth y paquetes no demuestran que las migraciones posteriores estén aplicadas.

## Revisión de Rodrigo a Gabriel

Revisión parcial efectuada sobre el código integrado y el build real, con un
navegador aislado sin sesión. Los siguientes puntos impiden recorrer la entrega
completa de Gabriel; no se modificaron sus pantallas ni su checkout.

### G-01 — El asistente todavía no crea reservas

- Ruta: `/reservar`.
- Usuario/rol: visitante; el servicio también declara que no está conectado al wizard.
- Pasos: abrir el asistente y revisar el aviso del catálogo y la preparación.
- Esperado: al confirmar, autenticar/verificar y crear reserva persistente mediante RPC.
- Actual: muestra «Catálogo temporal», fechas/cupos/precios de ejemplo y avisa
  que todavía no se crean reservas ni se apartan cupos. El servicio
  `lib/services/reservations.ts` existe, pero no tiene llamada desde una Server Action.
- Severidad: **Blocker** para el flujo público completo.
- Evidencia local: `.next/operations-audit/gabriel-reservar.png` (captura no versionada).

### G-02 — Falta la ruta de detalle de tanda

- Ruta: `/reservar/[slotId]`.
- Usuario/rol: visitante.
- Pasos: revisar el árbol de rutas del build y abrir una URL con un UUID de tanda.
- Esperado: página de detalle de tanda real; rechazo controlado si no existe.
- Actual: la ruta dinámica no está implementada en el árbol del build; HTTP 404.
- Severidad: **Blocker** para el enlace calendario → detalle de tanda.

### G-03 — Falta la pantalla de pago/subida de comprobante

- Ruta: `/reservas/[id]/pago`.
- Usuario/rol: piloto verificado (prueba autenticada pendiente).
- Pasos: revisar las rutas compiladas y buscar la página/acción de envío del pago.
- Esperado: comprobante privado + referencia + últimos cuatro dígitos + monto,
  con pago `uploaded` y reserva `payment_review` persistentes.
- Actual: ruta/acción ausentes del código integrado. Sin sesión el proxy devuelve
  307 a login; esa redirección no prueba que exista una pantalla de pago detrás.
- Severidad: **Blocker** para recibir pagos en la bandeja de Rodrigo.

### Dependencias adicionales

- El calendario `/karting/kartingrentalexperience/reservar` devuelve 404 en el build
  integrado. Es entrega de Andrés, cuya rama aún no figura integrada en main.
- La base remota carece de la columna agregada por la migración web de Gabriel.
  Debe verificarse el historial de migraciones antes de aplicar la de Rodrigo.
- No se ha confirmado un despliegue automático desde GitHub a Supabase.

## Requisitos para continuar con datos reales

1. El usuario inicia sesión en la CLI: `npx supabase login` desde `pitlane`.
   No compartir tokens, contraseñas ni secret/service-role keys en el PR o chat.
2. Confirmar la entrega de Andrés y respetar el orden acordado antes de integrar
   Rodrigo. El PR #13 de Gabriel ya está en main; eso no completa su checkout.
3. Vincular el proyecto correcto y revisar `npx supabase migration list` y
   `npx supabase db push --dry-run`. Revisar toda migración pendiente y comparar
   las tablas ya existentes; no reparar el historial a ciegas ni ejecutar SQL
   de esquema en el dashboard.
4. Aplicar exclusivamente el conjunto revisado mediante el flujo de PR/merge
   del equipo y verificar tablas, funciones, RLS y bucket privado.
5. Disponer de cuentas verificadas de piloto A, piloto B, staff, payments y admin.
   Los cambios de roles los realiza un administrador autorizado; no usar keys
   privilegiadas ni modificar roles de compañeros como atajo para la prueba.
6. Usar una fecha/tandas y reservas identificadas como pruebas, con al menos dos
   tandas futuras del mismo día y un comprobante ficticio sin datos bancarios reales.
   No realizar transferencias reales. Anotar IDs para distinguir estos datos.

## Recorrido de aceptación de Rodrigo

Ejecutar después de los requisitos anteriores, sobre la misma instancia de la app
y Supabase. Registrar IDs, rol, resultado y evidencia; no guardar credenciales ni
comprobantes bancarios reales en Git. Actualmente todos estos pasos siguen pendientes
de validación remota autenticada.

| Paso | Acción | Comprobación exigida |
| --- | --- | --- |
| 1 | Piloto completa reserva y envía comprobante por el flujo de Gabriel | Reserva `payment_review`, pago `uploaded`, objeto privado existente |
| 2 | Payments abre comprobante | URL firmada funciona; visitante/staff no acceden al objeto |
| 3 | Payments aprueba y reintenta | Una aprobación; reserva `paid`; auditoría con actor; sin duplicados |
| 4 | Piloto abre Mis reservas | Importe/participantes correctos, QR visible, descarga PNG y calendario ICS |
| 5 | Staff lee QR o busca código/nombre | Una asistencia por participante; repetición conserva hora original |
| 6 | Staff intenta segunda vuelta antes de completar primera | Operación rechazada; sin venta ni pago nuevos |
| 7 | Termina la tanda y staff confirma primera vuelta | `first_ride_completed` solo del participante que asistió, con actor/hora |
| 8 | Staff vende Segunda vuelta en la siguiente tanda | Reserva `paid`, pago `track_cash`, cupo descontado una vez, responsable registrado |
| 9 | Admin abre reportes y CSV | Asistencia, transferencia y efectivo coinciden con DB; sin multiplicar importes |
| 10 | Payments rechaza otro pago con motivo y concilia uno aprobado | Motivo visible al piloto; conciliación no duplica ingreso |
| 11 | Staff cierra tanda con ausentes | No-show individual; cierre repetido no duplica filas |
| 12 | Admin emite crédito por incidente de una reserva de prueba | Monto realmente pagado, origen/motivo/actor, reserva cancelada, saldo visible al dueño, sin vencimiento |
| 13 | Piloto B intenta acceder a reserva/QR/crédito del piloto A | Sin datos ajenos; staff no puede aprobar pagos; piloto no accede a reportes |
| 14 | Revisar consola/red y refrescar cada pantalla | Sin errores; los cambios persisten tras recargar y cambiar de sesión |

Para Friends: crear cinco participantes y comprobar llegada parcial (1 + 4),
sin duplicados, y que completar la vuelta de uno no habilite la de los otros.
Para sobreventa: repetir último cupo web/efectivo con dos sesiones reales; solo
una operación debe consumirlo. Las pruebas de PostgreSQL local ya cubren esto.

## Teléfono de pista y revisión cruzada

- Abrir la app desplegada con HTTPS en el teléfono. Permitir cámara, leer un QR
  pagado real de prueba y verificar la tanda antes de confirmar la entrada.
- Probar permiso denegado, ingreso manual, cerrar/reabrir cámara y QR repetido.
- Repetir con QR cancelado y de otra tanda: deben rechazarse sin asistencia nueva.
- Registrar modelo/navegador y resultado. El navegador headless con fixtures no
  sustituye esta prueba de cámara física.
- Andrés debe ejecutar el recorrido de Rodrigo y registrar su resultado. La
  revisión de código o las pruebas del asistente no se atribuyen a Andrés.
- Rodrigo termina la revisión de Gabriel cuando estén conectados calendario,
  reserva y pago; G-01/G-02/G-03 permanecen abiertos hasta entonces.

## Criterio de cierre

PR integrado en el orden acordado, migración verificada en remoto, recorrido
anterior aprobado con datos persistentes, revisión de Andrés registrada y cámara
física probada. Mientras falte cualquiera, la entrega no se declara finalizada.
