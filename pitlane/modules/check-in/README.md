# Check-in local de prueba

Primera pieza del módulo de Rodrigo para HU-05 / RF-07. No está conectada a
pantallas, reservas reales, pagos ni autenticación. Los datos de
`fixtures/simulated-reservations.mts` son explícitamente ficticios y solo los
importan las pruebas. La lógica no depende de React ni de Next.js.

## Ejecución y contrato de la función

Desde `pitlane`, ejecutar `npm test` con Node 22.18+ o Node 24 (verificado con
24.16.0). Se usa el ejecutor integrado de Node y su lectura nativa de TypeScript;
no se agregan dependencias. Los archivos `.mts` declaran módulos TypeScript ESM
sin cambiar la configuración de módulos del resto de la aplicación.
Para comprobar tipos y estilo, ejecutar
`npx tsc --noEmit` y `npm run lint`. La aplicación conserva sus scripts habituales.

`createLocalCheckIn(reservations, clock?)` crea una copia en memoria de los datos.
El reloj opcional devuelve un `Date` y permite pruebas deterministas. Reutilizar
esa misma instancia para llamar a `register({ code, eventDate, slotId })`.
`listAttendance()` devuelve copias de las marcaciones para inspección.

- `registered`: crea una marcación con `reservationId` y `checkedInAt`; devuelve
  también `holderName` y `seats`.
- `already_registered`: devuelve la primera marcación, conserva su hora y no
  consulta de nuevo el reloj ni agrega otro registro.
- `rejected`: devuelve `unknown_code`, `reservation_not_paid`, `wrong_date`
  o `wrong_slot`. No modifica las marcaciones.

El orden de validación es código, estado, fecha y tanda, seguido de asistencia
previa. Una reserva ya marcada tampoco se acepta en una tanda incorrecta.
La comparación de códigos es exacta, sin convertir mayúsculas ni quitar espacios.

Los estados se alinearon con el plan full-stack: solo `paid` permite una marcación
nueva. `attended` únicamente devuelve una marcación ya existente (reintento).
`pending_payment`, `payment_review`, `cancelled`, `expired` y `no_show` se rechazan.
El rechazo se llama `reservation_not_paid`. No se deduce el estado del pago ni se
modifica la reserva original. Esto sigue siendo un prototipo local de pruebas.

## Propuesta de datos del módulo de reservas

Este contrato es una propuesta de integración, no un acuerdo definitivo del equipo
ni un cambio al modelo del flujo de reservas existente.

| Campo | Tipo y significado propuesto |
| --- | --- |
| `id` | Identificador estable y único de la reserva. |
| `code` | Código único para localizarla; no representa aún el contenido definitivo del QR. |
| `holderName` | Nombre visible del titular. |
| `seats` | Entero positivo con los cupos del grupo. |
| `eventDate` | Fecha operativa `YYYY-MM-DD` en El Salvador; se compara como texto, no como fecha UTC. |
| `slotId` | Identificador estable de la tanda asociada a esa fecha. |
| `status` | `pending_payment`, `payment_review`, `paid`, `cancelled`, `expired`, `attended` o `no_show`. |
| `checkedInAt` | `null` si no hay asistencia; de lo contrario, la primera hora en formato ISO 8601 UTC. |

Los campos de reserva deberán venir del módulo de reservas. `checkedInAt` es
información operativa de check-in: queda pendiente acordar si llega combinada con
la reserva o mediante otro repositorio. No debe reemplazar el estado de reserva.

El prototipo recibe objetos confiables con este tipo; no es un validador de JSON
externo. Exige IDs y códigos únicos al crear la instancia y rechaza duplicados.
Las nuevas horas se producen con `Date.toISOString()`. Por ejemplo, las 18:01 del
25 de septiembre en El Salvador se guardan como `2026-09-26T00:01:00.000Z`, sin
cambiar la fecha operativa `2026-09-25`.

## Límites y decisiones pendientes

- La prevención de duplicados es solo local a una instancia síncrona en memoria.
  Otra instancia o dispositivo puede registrar la misma reserva. Reiniciar pierde
  las nuevas marcaciones. No hay persistencia, sincronización ni modo sin conexión.
- La instancia es una fotografía inicial: no recibe cancelaciones ni cambios de
  pago posteriores. No debe usarse para controlar acceso real.
- Persistir la validación de `paid` y su pago aprobado en una transacción, junto
  con asistencia única y autor. Una reserva en revisión no habilita acceso.
- Definir la ventana de llegada: aquí se compara la tanda seleccionada, pero no
  se comprueba si está en curso o próxima a iniciar.
- Acordar asistencia por grupo o por participante. Aquí se marca toda la reserva.
- Definir formato, vigencia y revocación del identificador QR, permisos de staff,
  autor de la marcación y origen confiable de la hora.
- Para integración real, acordar validación de entradas, lectura de estados
  actuales y escritura atómica persistente que impida duplicados concurrentes.

No incluye generación o lectura de QR, cámara, correos, ausencias automáticas,
servicios externos ni cambios al flujo de reservas o pagos. Las reglas nuevas
de primera/segunda vuelta por participante están en `lib/operations/rules.ts`;
este prototipo de check-in por grupo no demuestra elegibilidad individual.

Ver `docs/OPERATIONS_RODRIGO.md` para el alcance, avance y dependencias reales.
