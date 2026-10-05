# Reservas: contrato y límite del primer bloque

Estado: diseño revisable y tipos de dominio, sin migración ni RPC ejecutable.
No se ha conectado el booking ni cambiado el Supabase compartido. Este documento
no certifica reglas de negocio implementadas: describe el siguiente bloque SQL.

## Verificación de integración

Se verificaron las ramas con `git ls-remote --heads origin`. Las puntas remotas
coinciden con los objetos locales inspeccionados:

- `main` y `feature/reservation-engine`: `a7a5b43`.
- `feat/kre-landing-calendar`: `b7b22c0`.
- `feat/styleseed-landing`: `593bcba`.

El trabajo integrado de Andrés incluye componentes KRE, `domain/events/types.ts`
y `lib/catalog.ts`. `docs/KRE_ANDRES.md` y `docs/PR_KRE_ANDRES.md` explican que
consumen el catálogo simulado del booking. No incluyen DDL de events/slots/packages.
Las únicas migraciones de main crean profiles y sus roles/permisos.

También se hicieron consultas GET a la API REST del Supabase configurado, con la
clave anon existente y `select=*&limit=0`, sin leer filas ni imprimir credenciales:

| Relación consultada | HTTP | Código |
| --- | --- | --- |
| profiles | 200 | — |
| events | 404 | PGRST205 |
| slots | 404 | PGRST205 |
| packages | 404 | PGRST205 |
| reservations | 404 | PGRST205 |
| reservation_participants | 404 | PGRST205 |

Esto acredita que esas relaciones no fueron encontradas en el esquema expuesto
por la API consultada; **no prueba su ausencia física en PostgreSQL**, ni descarta
trabajo no publicado de otro integrante. No hubo acceso al catálogo SQL con un
rol administrativo. No se crean tablas de catálogo basándose en estos 404.

## Contrato pendiente de Andrés

Se necesita la migración/DDL vigente o acordada, no datos de producción ni claves:

| Dependencia | Información necesaria para escribir SQL compatible |
| --- | --- |
| Eventos | Esquema, tabla, PK/tipo, publicación/cierre y fecha operativa. |
| Slots | Esquema, tabla, PK/tipo, FK a evento, inicio/zona horaria, duración, estado y capacidad física. |
| Cupos de pista | Columna o fuente de la reserva para pista; si la capacidad publicada ya la descuenta; cómo se contabilizan ventas en pista para no descontarlas dos veces. |
| Packages | Esquema, tabla, PK/tipo, nombre, precio/unidad monetaria, cupos por paquete, activación y ámbito por evento/slot si existe. |
| Elegibilidad | Cómo distinguir Individual/Friends de paquetes no permitidos en la reserva inicial sin comparar nombres visibles. |
| Escrituras concurrentes | Contrato de bloqueo para ediciones de capacidad/cierre y futuras ventas en pista. |

Los tipos visuales `Slot.id: string` y `Package.priceCents: number` no prueban que
existan columnas SQL UUID o integer con esos nombres. Tampoco `availableSeats`
de la UI puede ser la autoridad de capacidad para una RPC.

Para despejar la ausencia física, el responsable de DB puede revisar las
migraciones aplicadas y consultar `pg_catalog.pg_class`/`pg_namespace` buscando
las relaciones de catálogo en todos los esquemas. Aun si no existen, hace falta
acordar sus contratos con Andrés antes de crearlas. No se pide una service role.

**Límite de implementación:** no crear relaciones sin FK, IDs de catálogo
provisionales, SQL que ignore tablas faltantes, RPC que acepte precio/cupos del
cliente ni un servicio que invoque una función inexistente. La migración de
reservas se escribirá cuando puedan incluirse las FK reales desde el principio.

## Modelo propio propuesto

Los nombres siguientes pertenecen a esta vertical. Son una propuesta para una
migración nueva posterior a `20261005003941_align_roles_with_plan.sql`; no se
modificarán migraciones existentes. Los nombres/tipos de las FK de catálogo
siguen pendientes, por lo que aquí no se incluye DDL ejecutable.

### reservations

| Campo | Tipo/regla propuesta |
| --- | --- |
| id | UUID, PK, generado por DB. |
| user_id | UUID NOT NULL, FK a profiles.id; obtenido de auth.uid(), no de la entrada. |
| slot/package | FK NOT NULL a las relaciones reales; nombre y tipo pendientes del contrato. |
| status | Texto NOT NULL, default pending_payment y CHECK de estados permitidos. |
| package_name_snapshot | Texto NOT NULL, nombre leído del paquete. |
| total_price_cents | Integer NOT NULL, positivo; precio total del paquete obtenido de DB. |
| currency | Texto NOT NULL, CHECK USD. |
| spots_required | Integer NOT NULL, CHECK entre 1 y 10; obtenido del paquete. |
| created_at | Timestamptz NOT NULL asignado por DB. |
| expires_at | Timestamptz NOT NULL, mayor que created_at. |
| idempotency_key | UUID NOT NULL aportado por el cliente. UNIQUE (user_id, idempotency_key). |
| request_payload | JSONB NOT NULL, contenido normalizado construido por la RPC para detectar reintentos diferentes. No contiene precios del cliente. |
| waiver_version | Texto NOT NULL; versión aceptada validada contra la versión habilitada del lado servidor. |
| waiver_accepted_at | Timestamptz NOT NULL asignado por DB tras comprobar aceptación explícita. |

Los estados previstos son pending_payment, payment_review, paid, cancelled,
expired, attended y no_show. Definir el vocabulario no implementa pagos ni
check-in. Un CHECK de estados tampoco autoriza transiciones: los clientes no
tendrán UPDATE y cada futura operación autorizada validará su transición.

Los snapshots no se recalculan cuando cambie el catálogo. La migración protegerá
mediante trigger las columnas históricas, propietario, referencias de catálogo,
creación, vencimiento inicial, waiver y contenido de idempotencia frente a UPDATE.
No habrá renovación de retenciones en este bloque. Las FK de catálogo usarán
RESTRICT para conservar el historial; el catálogo deberá desactivarse en vez de
borrar objetos referenciados. La FK de propietario también preservará historial.

### reservation_participants

| Campo | Tipo/regla propuesta |
| --- | --- |
| id | UUID, PK, generado por DB. |
| reservation_id | UUID NOT NULL, FK a reservations.id, ON DELETE RESTRICT. |
| position | Integer NOT NULL, CHECK entre 1 y 10; UNIQUE (reservation_id, position). |
| full_name | Texto NOT NULL, recortado y con longitud de 1 a 120 caracteres. |

Se guardará una fila por participante, incluido el titular si participa. No se
supondrá que todos tienen cuenta ni se usará el nombre para comprobar identidad.
No se impondrá unicidad de nombres: dos participantes pueden llamarse igual.

La RPC exigirá exactamente spots_required participantes y posiciones consecutivas.
Un constraint trigger diferible al final de la transacción comprobará cardinalidad
y posiciones también ante escrituras privilegiadas sobre cualquiera de las dos
tablas. Un CHECK ordinario no puede garantizar el conteo de filas hijas.
Friends consume cinco cupos y persiste cinco participantes o revierte por completo.

### Índices y retención

- Índice de reservas por slot y estado para el conteo bajo bloqueo.
- Índice por user_id y created_at para consultas del propietario.
- Índice parcial de expires_at para status = pending_payment; sin now() en el predicado.
- UNIQUE de idempotencia por propietario y UNIQUE de posición por reserva.
- Duración de retención positiva y acotada en configuración confiable del servidor/DB,
  nunca argumento controlado por el navegador. El valor operativo se acordará antes
  de habilitar creación. El vencimiento no superará el inicio de la tanda.

Una retención pending_payment solo consume capacidad mientras expires_at sea
posterior al reloj de DB. payment_review, paid, attended y no_show se contabilizan
sin depender de esa retención inicial; cancelled y expired no consumen cupos.
No se admitirán nuevas reservas para tandas ya iniciadas. La transición explícita
a expired y su scheduler quedan para un bloque posterior; su retraso no deberá
impedir que una retención vencida deje de contar.

## RLS y permisos propuestos

- Activar RLS en ambas tablas y revocar permisos de PUBLIC/anon/authenticated
  antes de conceder exclusivamente SELECT a authenticated.
- El pilot solo lee reservations donde user_id = auth.uid().
- Participants se lee únicamente cuando su reserva pertenece al usuario.
- payments y system_admin podrán leer para la integración autorizada, usando
  public.has_role(array['payments', 'system_admin']). No tendrán UPDATE directo.
- No conceder lectura general a staff/kre_admin en este bloque: operaciones
  acordará después el acceso mínimo necesario con Rodrigo.
- No habrá políticas ni grants de INSERT/UPDATE/DELETE para clientes, tampoco
  basados solo en ownership. Así no pueden elegir precio, cupos ni estados.
- La RPC futura será SECURITY DEFINER, search_path vacío y referencias calificadas.
  Revocará EXECUTE de PUBLIC/anon y concederá EXECUTE solo a authenticated.
  Validará auth.uid() internamente y no aceptará user_id como parámetro.
- La autorización de lectura de un administrador no permite reservar a nombre
  ajeno. Las operaciones privilegiadas futuras tendrán contratos separados.

Los servicios reutilizarán lib/supabase/server.ts y lib/auth. No habrá otro cliente
Supabase ni uso de service role en el flujo web. La comprobación de correo debe
alinearse con Carlos; la configuración local no demuestra la política remota.

## Diseño de create_reservation (RPC pendiente)

No se fija aún la firma SQL: los tipos de slot/package dependen de las PK reales.
Entrada conceptual: identificadores de slot/package, lista de nombres, aceptación
y versión de waiver, clave UUID de idempotencia. No recibe precio, cupos,
capacidad, estado, vencimiento ni identidad del propietario.

Algoritmo para una única transacción PostgreSQL:

1. Validar identidad y requisitos de acceso; normalizar y validar estructura,
   límites de participantes, nombres, waiver e idempotency_key.
2. Tomar un advisory lock transaccional derivado de (auth.uid(), idempotency_key).
   Esto serializa reintentos incluso si todavía no hay fila que bloquear. Una
   colisión de hash solo serializa más solicitudes; la unicidad usa valores reales.
3. Buscar una reserva del usuario con esa clave. Si existe y el payload normalizado
   coincide, devolver esa misma reserva en su estado actual, sin renovar expires_at
   ni volver a descontar cupos. Si difiere, rechazar por conflicto de idempotencia.
   Este paso precede a revalidar el catálogo: un reintento no cambia el resultado
   histórico aunque el paquete haya cambiado o la retención haya vencido.
4. Para un intento nuevo, bloquear los recursos confiables en un orden común:
   evento relevante FOR SHARE, slot FOR UPDATE y paquete FOR SHARE. Revalidar
   relaciones y publicación bajo esos bloqueos. Los nombres de tablas y el orden
   definitivo se acordarán con los escritores del catálogo para evitar deadlocks.
5. Leer precio, cupos y elegibilidad del paquete. Validar paquete activo, evento
   publicado, tanda abierta de 10 minutos y capacidad física máxima de 10.
   Validar exactamente N participantes; nunca convertir un combo en reserva parcial.
6. Obtener clock_timestamp() después de esperar los bloqueos; validar inicio futuro
   y calcular expires_at desde esa hora y la configuración confiable. No usar el
   reloj del navegador ni un now() tomado antes de una espera larga por bloqueo.
7. Calcular capacidad web utilizable según el contrato de cupos para pista y restar
   los spots_required históricos de reservas consumidoras, excluyendo retenciones
   vencidas. No confiar en availableSeats leído previamente por React.
8. Rechazar si no alcanza para todo el grupo. Insertar reservation en pending_payment,
   snapshots, payload de idempotencia, waiver y todos los participantes. Los
   constraints validan el conjunto; cualquier error revierte toda la operación.
9. Devolver el identificador/estado de la reserva persistida. El servicio convertirá
   errores de dominio a respuestas tipadas sin filtrar SQL ni detalles privados.

Dos solicitudes distintas al mismo slot se serializan con FOR UPDATE: la segunda
cuenta la reserva ya confirmada por la primera transacción antes de insertar.
Esto exige que todos los escritores de capacidad usen ese mismo protocolo y un
aislamiento compatible; bajo un snapshot obsoleto se debe abortar/reintentar, no
seguir con un conteo viejo. No basta con proteger únicamente la ruta web.

El servicio de creación y los tipos de entrada/salida completos se agregarán junto
con la RPC real. No se incluye un stub que aparente reservar correctamente.

## Tipos preparados y validación del siguiente bloque

domain/reservations/types.ts contiene solo estados, snapshots, participantes y
núcleos de intención/reserva independientes de las relaciones pendientes. No son
tipos de filas Supabase, no se pasan a insert() y readonly no sustituye validación
en DB. No se exporta todavía un modelo completo Reservation ni una firma RPC.

Las pruebas de PostgreSQL requeridas al implementar la migración son:

1. Dos conexiones compiten por el último cupo: exactamente una reserva persiste.
2. Dos combos compiten por menos de diez cupos: nunca se persiste un grupo parcial.
3. Cupos reservados para pista reducen capacidad sin doble descuento de ventas.
4. Manipular precio/cupos, escribir directamente o leer reservas ajenas falla.
5. Reintentos concurrentes con igual usuario/clave crean una sola reserva; cambiar
   contenido con esa clave falla; usuarios distintos pueden usar la misma clave.
6. Reintentar una reserva vencida devuelve la misma, sin renovar retención.
7. Una retención vencida no cuenta, aun antes del proceso de expiración.
8. Cantidad/nombres/posiciones inválidos revierten también la reserva padre.
9. Cambiar precios de catálogo no modifica snapshots existentes.
10. Cerrar o editar capacidad concurrentemente respeta el protocolo de bloqueo.

No presentar tests de mocks como evidencia de atomicidad PostgreSQL. Lint,
TypeScript, tests existentes y build comprueban compatibilidad del repositorio;
las pruebas anteriores requieren la migración real y una DB de prueba aislada.

## Segundo bloque: preparación del booking

Se conservan los cuatro pasos y el diseño del wizard. En Resumen se completan
un participante para Individual o cinco para Friends Combo, incluido el principal.
La página intenta obtener el nombre de profiles del usuario autenticado y, si no
está disponible, usa full_name de sus metadatos como sugerencia editable. Sin
sesión/nombre, el campo empieza vacío. No se pasa el objeto de sesión al cliente.

El estado permanece en React: no hay localStorage, escrituras en Supabase ni
reserva creada. Cambiar de paquete ajusta los campos: al pasar a Individual se
descartan los cuatro adicionales; al volver a Friends se piden nuevamente.
Cambiar fecha, tanda, paquete o nombres revoca la aceptación anterior. Volver
entre pasos sin cambiar la selección conserva el borrador.

El validador de dominio en preparation.ts exige cantidad exacta, nombres de
1–120 caracteres después de trim y aceptación explícita. El contador del catálogo
temporal sirve solo para preparar la UI: no es un cupo confiable para la futura RPC.
No se identifica a personas por nombre ni se prohíben nombres duplicados.

No existe todavía un waiver oficial en el repositorio. La UI muestra las reglas
de selección conocidas y una aceptación obligatoria, inicialmente desmarcada,
indicando que es temporal y que el documento definitivo está pendiente. No se
inventa una versión oficial ni se persiste evidencia de consentimiento. Antes de
habilitar reservas reales se deberá mostrar el waiver publicado, obtener su
versión confiable y validar/registrar aceptación en DB.

El botón final dice «Revisar datos de reserva» y solo se habilita con datos válidos
y aceptación. Su handler vuelve a validar las precondiciones; después muestra
explícitamente que no se crean reservas ni se guardan los datos. Ese es el punto
futuro de integración con el servicio, no un servicio simulado ni una respuesta
de éxito. No se genera código de reserva, vencimiento ni clave de idempotencia.

### Continuidad de autenticación, sin modificar archivos de Carlos

El enlace desde el resumen construye `/login?next=...` con retorno fijo a
`/reservar?evento=...&tanda=...&paquete=...`. El login existente ya respeta ese
destino. Solo viajan los IDs; nunca nombres o aceptación. La página vuelve a
validar esos IDs contra el catálogo al regresar. El usuario ve que debe iniciar
sesión antes de completar nombres: salir de la página pierde el borrador local.

La continuidad completa por registro, recuperación y verificación queda pendiente
de Carlos. Propuesta para un cambio separado en su infraestructura:

- Propagar un `next` validado por los enlaces login/registro/recuperación y el
  retorno de verificación de correo, conservando únicamente rutas internas seguras.
- En proxy.ts y requireAuthenticatedUser, preservar los parámetros de selección
  además del pathname cuando el acceso protegido provoca el redirect.
- Alinear el inicio por rol pilot con la ruta real de booking.

Este bloque no modifica proxy.ts, lib/auth ni app/(auth).

### Validación de este bloque

`npm test` incluye las pruebas existentes de check-in y las nuevas pruebas de
preparación: conteos 1/5, grupos incompletos, nombres, aceptación, cambios de
cantidad y retorno seguro de login. Estas pruebas no certifican creación de
reservas ni atomicidad. Ejecutar además lint, TypeScript y build.

Revisión manual en navegador pendiente: abrir selección Individual y Friends
desde KRE/URL, comprobar prellenado con sesión, errores al salir de campos vacíos,
cambio Friends → Individual → Friends, revocación del checkbox al editar, botón
final sin éxito falso, retorno desde login y navegación móvil/teclado.
