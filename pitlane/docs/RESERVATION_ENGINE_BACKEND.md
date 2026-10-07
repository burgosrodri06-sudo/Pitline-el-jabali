# Backend de reservas — contrato compartido, Bloque 3.2

La integración posterior del Bloque 4 se documenta en
[RESERVATION_WIZARD_INTEGRATION.md](RESERVATION_WIZARD_INTEGRATION.md).
Las menciones a wizard desconectado describen el alcance histórico de 3.2;
el nuevo envío web está implementado pero cerrado por defecto, solo para staging.

## Migraciones y autoridad

Ejecutar en orden las migraciones oficiales de profiles/auth/roles, schema_base
y seed_packages, y después `20261006000200_web_reservation_creation.sql`.
No se edita schema_base ni seed_packages. Los tres paquetes oficiales permanecen:
Individual $15/1, Segunda vuelta $10/1/requires_first_ride, Friends Combo $50/5.

Las dos migraciones incompatibles del motor anterior fueron retiradas sin haber
sido aplicadas al compartido, junto con su catálogo demo. No desplegar estas
eliminaciones como DROP sobre una DB: son archivos nunca aplicados. Si alguien
aplicó aquellas versiones en una DB local, debe usar otra DB desechable para este
contrato, no intentar aplicar la incremental sobre el schema anterior.

Solo se agregan dos columnas nullable a reservations:

- `idempotency_key uuid`: índice único parcial `(user_id,idempotency_key)` para
  canal web con clave no nula.
- `request_fingerprint bytea`: SHA-256 de slot, package, lista ordenada de nombres
  normalizados y aceptación. Permite comparar el intento original sin repetir
  datos personales en JSON ni agregar posiciones al schema de participantes.

El CHECK exige ambos valores juntos, huella de 32 bytes, canal web y propietario.
Filas existentes sin ambos valores siguen siendo válidas. No se agrega otra
columna de snapshot: amount y spots conservan precio y cupos históricos.

## RPC

```sql
public.create_reservation(
  p_slot_id uuid,
  p_package_id uuid,
  p_participants jsonb, -- [{"full_name":"Ana"}, ...], sin campos adicionales
  p_idempotency_key uuid,
  p_rules_accepted boolean
) returns jsonb
```

Respuesta: `id`, `code`, `status`, `amount`, `spots`, `expiresAt`. Amount representa
USD, como packages.price. El servicio reutiliza la proyección del tipo compartido.

La identidad viene exclusivamente de auth.uid(). Se comprueba
auth.users.email_confirmed_at, alineado con requireVerifiedUser de Carlos, sin
confiar en metadatos editables ni flags del navegador. Auth continúa siendo el
responsable de confirmar correos; si su configuración confirma automáticamente,
esta RPC no puede sustituir la verificación de propiedad del correo.

La entrada exige rules_accepted=true; nombres de 1–120 caracteres después de
recortar espacios, tabulaciones y saltos exteriores. Rechaza campos extra,
incluidos is_holder y first_ride_participant_id. Primer participante = titular;
todos tienen first_ride_participant_id=NULL. El conteo debe coincidir exactamente
con packages.spots (1 o 5 en este flujo). No se comparan nombres comerciales.
Paquetes inactivos, fuera de vigencia según fecha de evento, o con eligibility
distinto de none se rechazan. Segunda vuelta sigue pendiente.

El evento debe estar open; la tanda available, futura y en la fecha del evento
según America/El_Salvador. La DB asigna user_id y created_by=auth.uid(), channel=web,
status=pending_payment, amount=packages.price, spots=packages.spots y timestamps.
Code y qr_token conservan los defaults oficiales; nunca vienen del browser.

## Idempotencia y atomicidad

Advisory lock transaccional por usuario+clave antes de buscar la reserva. Un
retry idéntico devuelve la misma fila en su estado actual, sin renovar el hold,
recalcular el precio ni insertar participantes. Cambios de tanda, paquete,
nombres u orden producen idempotency_conflict. Se conservan duplicados de nombre.
Aceptación falsa nunca permite crear ni recuperar por esta RPC: rules_required.

Para una creación nueva, el orden de bloqueo es:

1. Slot FOR UPDATE.
2. Event FOR SHARE.
3. Package FOR SHARE.
4. Consulta separada a `public.slot_available_spots(slot_id)` manteniendo el lock.
5. Insert de reservation y todos sus participantes dentro de la transacción.

La función PL/pgSQL es VOLATILE (default); bajo READ COMMITTED, la sentencia
posterior al bloqueo obtiene un snapshot nuevo. La función oficial STABLE ve los
commits previos, incluido el de una reserva por la que se esperó. Se rechazan
REPEATABLE READ/SERIALIZABLE para no aceptar snapshots anteriores a la espera.
No se modifica el slot ni se agrega allocation_version. Un fallo de validación o
de insert de participantes revierte todo, incluida la clave de idempotencia.

**Protocolo para los demás escritores:** pista, reactivaciones, pagos que vuelven
a consumir capacidad y cambios de cuota/capacidad deben bloquear la misma fila
de slot antes de consultar disponibilidad y escribir, con READ COMMITTED. Bloquear
múltiples slots en orden determinista. Evitar orden inverso evento→slot o
reserva→slot, que puede causar deadlocks. Validar de nuevo después de esperar.
Los errores transitorios se reintentan con la misma clave.

Esta RPC impide sobreventa entre llamadas web. No puede garantizarla ante un
propietario DB u otra futura función privilegiada que ignore el protocolo.
Coordinar con Carlos/Andrés/Rodrigo antes de introducir esos escritores.

## Hold y aceptación temporal

Se calcula después de esperar bloqueos, con clock_timestamp(): el menor entre
ahora+15 minutos y starts_at−1 microsegundo. Exige expires_at>ese mismo instante;
si la tanda ya está demasiado próxima devuelve slot_unavailable. Created_at y
rules_accepted_at usan ese instante. El hold vence estrictamente antes de iniciar.

No se recrea reservation_settings, DEV-ONLY ni versionado de waiver. La aceptación
temporal registra únicamente rules_accepted_at; no demuestra aceptación de un
documento legal definitivo. No se inventa contenido legal. A diferencia del
motor retirado, esta RPC NO bloquea por ausencia de versión oficial; esta decisión
es la del contrato solicitado para 3.2. La UI sigue desconectada.

Las pending_payment expiradas dejan de consumir conforme a la función oficial,
sin necesidad de limpiar estados. No se añade función de expiración ni cron.
Las semánticas de payment_review/paid y demás estados son las de main, sin otra
fórmula en SQL propio, servicios, frontend ni tests.

## RLS y grants

- Propietario: SELECT de sus reservas y participantes.
- staff/payments/kre_admin/system_admin: SELECT operativo de reservas y participantes.
- anon: sin lectura de reservas/participantes ni ejecución de esta RPC.
- authenticated: SELECT bajo RLS y EXECUTE de create_reservation; sin escritura directa.
- service_role: SELECT, sin escritura directa ni EXECUTE de create_reservation.
- PUBLIC: sin permisos sobre las dos tablas ni EXECUTE de la nueva función.

SECURITY DEFINER usa search_path vacío, referencias calificadas, sin SQL dinámico;
row_security=off hace fallar en lugar de contar silenciosamente filas filtradas
si el propietario perdiera bypass. Debe ser instalada por el propietario DB.
La validación de participantes se garantiza en esta RPC; no se imponen triggers
globales a otros flujos del schema congelado. Futuros escritores privilegiados
deben preservar conteo, titular, snapshots e idempotencia.

No se cambia la seguridad del catálogo de Carlos/Andrés. La función oficial
slot_available_spots es SECURITY DEFINER y permite consultar el agregado de un
slot por UUID; la vista sí aplica RLS de slots. La revisión de si la función
debe filtrar también tandas privadas corresponde a su dueño; no se reemplaza aquí.

## Pruebas y despliegue pendiente

`npm test` ejecuta preparación UI, tests existentes de check-in y motor SQL en
PGlite desechable. Bootstrap emula Auth (incluido email_confirmed_at), prerrequisito
Storage y grants Supabase, y ejecuta TODOS los archivos de migración ordenados,
incluidos schema_base y los tres paquetes, sin modificar su SQL. No usa seeds.

Se prueban snapshots desde DB, 1/5 participantes, titular, aceptación, correo,
idempotencia, rollback, cupos oficiales, expiración, RLS y permisos.
PGlite no prueba conexiones simultáneas.

`npm run test:reservations:concurrency` requiere RESERVATION_TEST_ADMIN_URL de un
PostgreSQL LOCAL desechable. Solo acepta loopback, crea una DB aleatoria y la
elimina al terminar; los roles pueden permanecer en ese clúster de pruebas.
Tres conexiones comprueban último cupo, dos combos para nueve cupos y la misma
clave concurrente; un observador exige ver un lock real antes del primer commit.
Nunca usar credenciales del compartido para este bootstrap.

Validación de este bloque: 44 tests pasaron y los tres escenarios de concurrencia
pasaron en PostgreSQL 18 local, con esperas reales observadas. El clúster temporal
se detuvo al terminar. Esto no sustituye JWT/PostgREST reales ni la validación
del proyecto Supabase antes de desplegar.

Antes de desplegar: validar historial remoto y ausencia de conflictos por el
responsable del proyecto, probar JWT/PostgREST reales en staging y coordinar
permisos de service_role/bloqueos con pagos y pista. El código corto oficial
KRE-XXXXXX puede colisionar: el índice único aborta sin crear parcialmente;
un retry con la misma clave genera un nuevo código si el intento no se persistió.
No se cambia el formato compartido en este bloque.

No se implementan pagos, Storage, waitlist, second lap, check-in, créditos,
reportes ni conexión del wizard. No se ejecuta SQL remoto ni se despliega aquí.
