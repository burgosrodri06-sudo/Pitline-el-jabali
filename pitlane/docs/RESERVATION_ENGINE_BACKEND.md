# Motor de reservas — Bloque 3

Implementado en archivos locales. No se ejecutaron migraciones ni seeds contra el
Supabase compartido. El wizard sigue con el catálogo visual temporal del bloque 2:
no llama al servicio ni a la RPC. No hay pagos, Storage, waitlist o Second Lap.

Revisión pre-deploy: se endurecieron las dos migraciones del bloque 3 **antes de
su primera aplicación compartida**. No se alteraron las tres migraciones previas
de Auth. Si alguien ya aplicó una versión anterior del bloque 3 en otro entorno,
no debe reaplicarla: necesita una migración de actualización explícita.

## Verificación previa y autoridad del esquema

Rama inicial limpia: feature/reservation-engine, commit 3814b70. Consulta nueva de
ramas remotas: main sigue en a7a5b43; las ramas KRE de Andrés siguen en b7b22c0 y
593bcba, sin DDL de catálogo. Se revisaron las tres migraciones de profiles/roles,
los tipos de reservas y el diseño anterior.

GET REST con select=*&limit=0 volvió a dar profiles=200 y
events/slots/packages/reservations/reservation_participants=404 PGRST205, sin leer
filas ni imprimir credenciales. Eso no prueba ausencia física. La autorización
expresa del bloque 3 permite ahora definir el contrato mínimo. Las migraciones
usan CREATE TABLE, sin IF NOT EXISTS: cualquier colisión remota detiene la
aplicación, no adopta silenciosamente un esquema desconocido. Antes de aplicarlas,
el equipo debe comprobar historial y catálogo SQL remoto con acceso autorizado.

## Migraciones y contrato de Andrés

- 20261006000000_reservation_catalog.sql: events, slots, packages, timestamps, RLS.
- 20261006000100_atomic_reservations.sql: reservas, participantes, configuración,
  constraints, permisos, RPC, expiración y lectura agregada de disponibilidad.

Todas las PK son UUID. Todas las FK preservan historial con ON DELETE RESTRICT.
Events tiene title, event_date (fecha operativa de El Salvador), status
draft/published/closed y created_at/updated_at. Slots tiene event_id, starts_at y
ends_at timestamptz separados por exactamente 10 minutos, capacity de 1 a 10,
track_reserved_capacity entre 0 y capacity, status open/closed y timestamps.
La RPC verifica que el inicio caiga en la fecha operativa del evento.

Packages es global: code único, name, price_cents entero positivo, spots_required
de 1 a 10, active, booking_type='initial' y timestamps. No hay ámbito por evento
en este contrato mínimo. La RPC no compara nombres ni códigos Individual/Friends:
lee precio y cupos del registro. No se permiten paquetes de vueltas adicionales.

Capacidad web = capacity - track_reserved_capacity - cupos de reservas activas.
La cuota de pista está completamente excluida de ventas web; en este bloque no se
registran ventas de pista. Rodrigo deberá usar esa cuota en su futuro módulo sin
descontarla nuevamente de reservas web. Si cambia la cuota/capacidad, la futura
operación debe bloquear el slot y rechazar reducciones por debajo de lo ocupado.

El catálogo habilita lectura pero no CRUD de clientes/admin. El futuro CRUD de
Andrés debe usar operaciones autorizadas, bloquear evento → slot → paquete y
validar impacto de cambios temporales/capacidad. No puede conceder escrituras
directas que evadan las reglas de asignación. allocation_version es interno y
se incrementa al asignar una reserva; no es un contador de disponibilidad.
La API no puede leer allocation_version ni updated_at de slots: ambos revelarían
actividad interna de asignación. Leer columnas explícitas:
`id,event_id,starts_at,ends_at,capacity,track_reserved_capacity,status,created_at`.
`SELECT *` sobre slots no está concedido a anon/authenticated, incluidos admins
de la aplicación. La RPC mantiene acceso interno a toda la fila.

## Reservas, participantes y seguridad

Reservations conserva user_id → profiles, slot_id, package_id, estados
pending_payment/payment_review/paid/cancelled/expired/attended/no_show,
package_name_snapshot, price_cents_snapshot, spots_snapshot y currency='USD'.
También expires_at, clave UUID de idempotencia, payload JSONB normalizado,
waiver_version, waiver_accepted_at, created_at y updated_at.

UNIQUE(user_id,idempotency_key) impide duplicados por propietario. Un trigger
rechaza cambios históricos (incluidos propietario, FK, vencimiento y snapshots);
solo permite status/updated_at a operaciones privilegiadas. No habilita todavía
transiciones de pagos o check-in. Cancelación/reactivación futura requiere una
RPC propia que use el mismo bloqueo y vuelva a verificar capacidad.

Participants guarda id, reservation_id, position de 1 a 10 y full_name recortado
de 1–120 caracteres; UNIQUE(reservation_id,position). Un constraint trigger
diferible verifica al commit la cantidad y posiciones de todo el grupo. Dos
personas pueden tener el mismo nombre. No se presume que tengan cuenta.

RLS y grants:

| Recurso | Lectura | Escritura desde clientes |
| --- | --- | --- |
| events/slots/packages | Publicados/abiertos/activos para anon y authenticated; kre_admin/system_admin también ven borradores | Ninguna |
| reservations | Propietario o staff/payments/kre_admin/system_admin | Solo creación por RPC; sin INSERT/UPDATE/DELETE directo |
| reservation_participants | Cuando la reserva es visible al usuario | Ninguna |
| reservation_settings | system_admin | Ninguna, tampoco service_role; configuración por propietario DB |

Se reutiliza public.has_role y profiles; no hay sistema paralelo de roles.
Las funciones privilegiadas fijan search_path vacío y califican relaciones.
No se usa service role en el servicio web. Auth.uid() determina al propietario.
Se requiere sesión; no se añade una política de correo diferente de Auth de Carlos.
Los roles operativos pueden leer reservas/participantes, no modificar estados.

La revisión ejecuta todas las migraciones en orden sobre una DB efímera que emula
también los grants por defecto de la API de Supabase (habilitados en config.toml).
profiles.id sigue siendo UUID con FK a auth.users; has_role(text[]) consulta los
cinco roles existentes; auth.uid() se usa sin redefinirlo en las migraciones.
Los metadatos de signup no conceden roles y los triggers existentes impiden que
un pilot se eleve. Las pruebas no sustituyen validar JWT reales en staging.

Ninguna función nueva conserva EXECUTE de PUBLIC. Solo authenticated ejecuta
create_reservation, solo service_role/propietario DB ejecutan expiración y
anon/authenticated ejecutan disponibilidad. Los helpers de trigger no tienen
EXECUTE concedido a roles API. Todos fijan search_path vacío. Los helpers previos
handle_new_user y protect_role_change conservan sus ACL originales: son funciones
RETURNS trigger, no pueden invocarse como RPC normal (verificado), y no se amplían
permisos de CREATE/TRIGGER para clientes. No se reescribe Auth de Carlos.

## RPC y servicio

```sql
public.create_reservation(
  p_slot_id uuid,
  p_package_id uuid,
  p_participants jsonb, -- [{"full_name":"..."}, ...], sin campos extra
  p_idempotency_key uuid,
  p_waiver_accepted boolean,
  p_waiver_version text
) returns jsonb
```

Solo authenticated tiene EXECUTE. No admite propietario, precio, cupos, estado
ni vencimiento. Devuelve id, status, price_cents_snapshot, spots_snapshot,
currency y expires_at. lib/services/reservations.ts adapta el contrato de dominio
y retorna errores de negocio permitidos; no es una Server Action ni está conectado
al wizard. Los tipos TS no reemplazan las validaciones SQL.

La RPC valida el payload y toma un advisory lock transaccional de usuario+clave.
Un reintento idéntico devuelve la misma reserva y vencimiento, incluso si el
catálogo cambió; un payload diferente falla. Nombres se recortan antes de comparar,
pero orden, slot, paquete y versión de waiver son materiales.

Para una creación nueva: evento FOR SHARE → slot FOR UPDATE → paquete FOR SHARE
→ configuración FOR SHARE. Comprueba publicación, estado, inicio futuro, paquete
activo y cantidad exacta. Con reloj DB posterior a las esperas calcula ocupación,
excluyendo pending_payment vencidas. Incrementa la versión del slot e inserta
reserva y participantes en la misma transacción. Un fallo revierte todo.
La segunda conexión espera el slot y cuenta lo confirmado por la primera.
Se exige READ COMMITTED (contrato de PostgREST); otro aislamiento se rechaza para
evitar lecturas obsoletas. Deadlocks/errores de conexión deben reintentarse con
la misma clave, nunca con un UUID nuevo por cada intento de red.

reservation_settings tiene hold_minutes=15 (configurable 1–60) y
active_waiver_version=NULL. **Las nuevas reservas fallan con waiver_unavailable
hasta publicar/configurar el waiver oficial**. No se inventa versión legal. La
UI deberá mostrar el documento antes de enviar aceptación. El vencimiento es el
menor entre inicio de tanda y reloj DB + retención; no hay renovación automática.
Antes del INSERT se refresca el reloj después del UPDATE del slot, se calcula
v_expires_at y se exige que sea posterior a ese mismo v_now usado como created_at.
Si la tanda ya inició durante el procesamiento, devuelve slot_unavailable y
revierte la asignación, sin violación genérica del CHECK ni margen mínimo nuevo.

### Waiver de prueba: habilitación explícita solo en DB de pruebas

No se inventó contenido legal. deployment_environment inicia en production,
waiver_mode en official y active_waiver_version en NULL. El CHECK
waiver_environment_guard prohíbe el prefijo DEV-ONLY (sin importar mayúsculas) en
modo official y prohíbe modo test en producción. Modo test requiere development
o staging y una versión con prefijo DEV-ONLY. Estos campos no vienen del request,
de variables NEXT_PUBLIC, de metadatos del usuario ni de GUCs del cliente.

Son necesarias dos decisiones explícitas del operador con conexión de propietario
DB. Incluso system_admin vía API y service_role carecen de UPDATE en settings.

1. Verificar fuera del SQL la identidad del proyecto: debe ser una DB de pruebas
   separada, nunca producción. Solo al provisionar esa DB, marcar el entorno:

   ```sql
   update public.reservation_settings
   set deployment_environment = 'staging' -- o 'development', según la DB real
   where id and waiver_mode = 'official' and active_waiver_version is null;
   ```

2. En esa DB ya marcada, habilitar la versión técnica de prueba. Este bloque por
   sí solo falla si la DB conserva la configuración productiva:

   ```sql
   begin;
   do $$
   begin
     perform 1 from public.reservation_settings
       where id and deployment_environment in ('development', 'staging')
       for update;
     if not found then
       raise exception 'Test waiver requires an explicitly provisioned test database';
     end if;
     update public.reservation_settings
       set waiver_mode = 'test', active_waiver_version = 'DEV-ONLY:staging-v1'
       where id;
   end $$;
   commit;
   ```

3. Llamar la RPC con esa versión exacta y aceptación explícita. En cualquier
   herramienta de prueba mostrar «SOLO PRUEBAS — no es un waiver oficial»; no
   publicar texto legal inventado. La reserva conserva el identificador DEV-ONLY.
   Esto permite probar el backend; el wizard continúa desconectado en este bloque.

Para deshabilitar pruebas, establecer active_waiver_version=NULL. Para volver a
una configuración productiva cerrada, cambiar los tres campos conjuntamente:

```sql
update public.reservation_settings
set deployment_environment = 'production', waiver_mode = 'official',
    active_waiver_version = null
where id;
```

Producción solo se habilita después de publicar el documento oficial y configurar
su identificador real en modo official. El motor no puede certificar el contenido
legal de una versión: esa aprobación pertenece al cliente/operador. Ningún seed ni
migración habilita pruebas automáticamente. Una restauración de staging hacia
producción exige resetear esta configuración y excluir datos de prueba antes de
abrir tráfico. La DB no puede detectar que su propietario la etiquetó mal.

## Expiración y disponibilidad

public.expire_reservations(p_batch_size integer default 500) devuelve filas
expiradas, procesa 1–5000 por llamada con FOR UPDATE SKIP LOCKED y solo cambia
pending_payment vencidas. EXECUTE reservado a service_role y propietario DB,
no a clientes autenticados ni a admins mediante el navegador.

No se instala cron automáticamente. Al habilitar pg_cron, ejecutar como rol DB
autorizado (no desde cliente) una programación equivalente a:

```sql
select cron.schedule('expire-reservations', '* * * * *',
  'select public.expire_reservations(500);');
```

Revisar que no exista ya el job y monitorizar el atraso; repetir lotes si hay más
vencidas que la capacidad del job. El contador de cupos ya ignora las vencidas
aunque cleanup no corra. payment_review/paid/attended/no_show consumen cupos;
cancelled/expired no. No se venden tandas iniciadas.

get_slot_availability() es pública, devuelve solo slot_id/available_spots para
slots futuros abiertos en eventos publicados. No revela propietarios ni nombres.
Es una lectura orientativa: la única autoridad al crear es la RPC bajo bloqueo.
Conservar SECURITY DEFINER es necesario en este esquema: SECURITY INVOKER no
puede contar las reservas ajenas protegidas por RLS y daría permisos insuficientes
o disponibilidad incorrecta. No tiene parámetros ni SQL dinámico y filtra por
publicación/estado/inicio. `row_security=off` no concede bypass: hace fallar la
consulta si un futuro propietario sin permisos de bypass intentara contar filas
filtradas. No se concede SELECT adicional sobre reservas o participantes.
El único dato inferible deliberadamente es la ocupación agregada del catálogo
público; no se devuelve identidad, cantidad de reservas, nombres ni timestamps
de asignación. Comparar disponibilidad a lo largo del tiempo sigue revelando
cambios de cupos, algo inherente a publicar disponibilidad exacta.

## Seeds y pruebas

No hay eventos ni paquetes en migraciones productivas. El archivo separado
supabase/dev/reservation-catalog.sql requiere opt-in explícito en sesión:
`SET pitlane.allow_development_seed = 'yes';` y debe ejecutarse con parada ante
errores, únicamente en DB local de desarrollo. Agrega Individual 1500/1, Friends
5000/5 y un evento claramente de desarrollo con slot 10/2. No configura waiver.
En producción se cargarán paquetes/configuración aprobados, sin este seed.

`npm test` ejecuta las migraciones completas en PostgreSQL WASM/PGlite efímero y
comprueba RPC, RLS, constraints, snapshots, cupos, expiración e idempotencia.
Auth se emula con una tabla users mínima y auth.uid() basado en GUC; se ejecutan
las migraciones reales de profiles/roles y los grants por defecto de la API.
Los tests configuran expresamente development/test/DEV-ONLY:automated-tests.
También verifican los defaults productivos cerrados, combinaciones prohibidas de
waiver, permisos efectivos por función, bloqueo de escalación, proyección pública
del catálogo y rechazo de una tanda que comienza durante una demora de asignación.
Esto no sustituye probar JWT/PostgREST
en Supabase ni prueba concurrencia nativa: PGlite usa una conexión.

Para PostgreSQL nativo local aislado, proporcionar RESERVATION_TEST_ADMIN_URL a
un servidor de pruebas con permiso CREATE DATABASE/CREATE ROLE y ejecutar
`npm run test:reservations:concurrency`. No usar credenciales de Supabase compartido.
El script solo acepta host loopback, crea una DB de nombre aleatorio, ejecuta
migraciones y tres escenarios con conexiones independientes: último cupo, dos
combos para nueve cupos y misma clave simultánea. Un observador exige ver una
espera real en pg_stat_activity antes de liberar el primer commit. Elimina solo
la DB creada por ese script. Los roles de prueba pueden permanecer en el clúster
local; usar un clúster desechable. No imprime la URL de conexión.

En este entorno no hay psql, Docker ni servidor PostgreSQL nativo configurado.
La prueba nativa queda pendiente; no se considera superada por los tests WASM.

Antes de producción: comprobar ausencia de conflictos SQL remotos, aplicar las
migraciones en staging, configurar catálogo y waiver oficial, probar con JWT de
dos usuarios las lecturas/RPC/denegaciones, ejecutar concurrencia nativa y programar
expiración. Este bloque no modifica ni conecta P-04 ni toca Auth/check-in.
