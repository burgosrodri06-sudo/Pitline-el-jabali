# Integración final de PitLane — estado para revisión

## Base y trabajo incorporado

Base: `origin/main` **b35cbeab21fc4a573af67f797f9e18d5c9f1a894**. Rama: `integration/final-demo-flow`. El working tree estaba limpio; no se descartó trabajo local. Se ejecutó fetch antes de trabajar.

PR #14 comprobado en GitHub: abierto, no draft, mergeable; head `1386f9d290a12de13c984d4c1b8af3ffdac4c7b9`, cinco commits por delante y cero por detrás de main. Su descripción sobre conflictos/borrador estaba desactualizada. Se incorporó esa rama con un merge local que conserva sus commits. No se integra otra vez `feature/events-slots-packages`.

Ya resueltos en main: calendario real de Andrés (`3586bce`, `b35cbea`), auth y continuidad login/registro de Carlos (PR #18/#19), inicio del piloto en `/reservar`, motor web, wizard y comprobantes (PR #13/#15/#16). Los hallazgos antiguos de wizard desconectado, checkout inexistente y calendario ausente no describen esta rama.

Incorporados de Rodrigo: Mis reservas, QR/PNG/ICS, revisión y conciliación de transferencias, check-in por participante/grupo, cierre/no-show, primera/segunda vuelta, venta en efectivo, emisión de créditos y reportes/CSV. Se conserva su arquitectura, guards, RPC, auditoría y pruebas. No se habilita canje de créditos ni reenvío de comprobantes: no tienen contrato implementado.

## Hallazgos y correcciones locales

- La prueba de receipts dependía antes de una rama remota. El último operations ya lo corrigió; se conserva y se elimina el parámetro obsoleto del bootstrap. Todos los SQL se leen del checkout actual.
- El defecto 5 pista + 5 web con reducción a 8 estaba corregido en `1386f9d`. Se incorpora su migración incremental y sus regresiones; no se reescribe el schema base.
- Verificación dependía de sessionStorage para conservar selección. Registro/verificación ahora llevan `?next=` explícito, también sin almacenamiento de navegador. La ruta protegida conserva query y cookies renovadas al enviar a login. Se rechazan retornos externos y separadores/control characters peligrosos.
- Landing/calendario enlazan directamente a `/reservar?evento=<uuid>&tanda=<uuid>&paquete=<uuid>`. `/reservar/[slotId]` permanece exclusivamente como adaptador de enlaces antiguos, sin segundo motor. No se mapean nombres/precios a IDs.
- La landing filtraba paquetes por hoy, permitía elegir Segunda vuelta como reserva inicial y redondeaba centavos. Ahora consulta paquetes activos, filtra vigencia por fecha elegida, conserva decimales y muestra Segunda vuelta sin permitir seleccionarla para el checkout inicial. Cambiar fecha limpia paquete; jornadas distintas de la misma fecha se seleccionan por ID. Se retiró el texto residual de evento de demostración.
- Navegación de cuenta/Mis reservas conectada en landing, calendario, wizard, comprobante y operations; administración enlaza reportes. La entrega de comprobante enlaza su seguimiento. Español en documento raíz y títulos por módulo. `/mockup` queda archivado, sin enlaces en la navegación y con noindex; sus datos no alimentan servicios reales.
- Mis reservas distingue el plazo vencido sin inventar un estado persistido y deja de ofrecer carga tras un pago rechazado. Página de pago muestra explícitamente que reenvíos no están habilitados.
- La prueba SQL del recorrido reserva → comprobante → aprobación → QR/check-in usa ahora `prepare_payment_receipt`, sin insertar directamente el pago ni cambiar artificialmente el estado en ese traspaso. Solo se emula el objeto del servicio externo Storage.
- Nuevas carreras reales de recibos: misma clave, otro intento sobre la misma reserva y vencimiento mientras se espera el lock. No hay pagos duplicados ni resurrección del apartado.
- Parches de seguridad: Next/eslint-config-next **16.3.8**, Sharp **0.35.5** y source-map-js actualizado dentro de rango. Auditoría de producción sin alertas; quedan cinco alertas de desarrollo de la cadena ESLint → fast-glob → micromatch → braces. npm propone bajar Next ESLint a 14 para resolverlas; no se aplica ese cambio incompatible ni `audit fix --force`.

## Migraciones finales y orden

No se renombró ni modificó SQL histórico. Una instalación limpia ejecuta todos estos archivos en orden:

| Orden | Archivo | Procedencia / dependencia |
| --- | --- | --- |
| 1 | `20261004000000_create_profiles.sql` | main; requiere Auth de Supabase |
| 2 | `20261005001501_admin_role.sql` | main; profiles |
| 3 | `20261005003941_align_roles_with_plan.sql` | main; roles definitivos/has_role |
| 4 | `20261005155117_schema_base.sql` | main; catálogo, reservas, pagos, RLS, bucket privado |
| 5 | `20261005155549_seed_packages.sql` | main; tres paquetes oficiales, parte del esquema versionado |
| 6 | `20261005180000_kre_inventory_admin.sql` | main; administración y triggers del catálogo |
| 7 | `20261006000200_web_reservation_creation.sql` | main; idempotencia y RPC web |
| 8 | `20261007182818_rodrigo_operations.sql` | incorporada de operations; RPC/políticas/guard de ocupación |
| 9 | `20261008000000_payment_receipt_upload.sql` | main; primera entrega e idempotencia de comprobantes |
| 10 | `20261008003300_align_operations_capacity_guard.sql` | incorporada de operations; requiere administración KRE y operations |

Los fixtures locales emulan `auth` y `storage`; **nunca aplicar esos bootstraps a Supabase**. No se ejecutaron `supabase/seed.sql`, `docs/demo-data.sql` ni SQL remoto.

Evidencia histórica, no verificación remota actual: docs de Andrés reportan aplicada `20261005180000`; la revisión de Rodrigo reporta comprobantes registrado antes de operations. La suite prueba también ese orden de actualización: comprobantes → operations → corrección. Por eso renombrar versiones ya publicadas sería incorrecto. El responsable debe comparar `schema_migrations`/historial real con estos archivos y revisar migraciones pendientes antes de desplegar; no repetir las ya aplicadas, reparar historial a ciegas ni ejecutar solamente la corrección. El despliegue remoto NO fue realizado en esta tarea.

## Capacidad, estados y seguridad

Contrato único de disponibilidad web: `capacity - web_consumed - max(track_reserved_spots, track_consumed)`, expuesto con mínimo cero; pista usa ocupación total sin restar dos veces su reserva. Consumen `payment_review`, `paid`, `attended`, `no_show` y `pending_payment` con hold vigente. `cancelled`, `expired` y holds vencidos no consumen. Friends es una asignación indivisible de cinco.

Todos los escritores compatibles toman **tanda → reserva → pago/asistencia/intento**; creación web/pista toma tanda → evento → paquete. READ COMMITTED y consulta de capacidad después de esperar el lock; el trigger protege inserciones/actualizaciones y el guard de KRE protege cambios de capacidad/cuota. No hacer UPDATE de reservas antes de tomar su tanda ni invertir el orden desde nuevos módulos. Cierres administrativos de eventos propagan a varias tandas y pueden competir con ventas: PostgreSQL puede abortar una transacción por deadlock; no hay commit parcial. Reintentar operaciones idempotentes conservando clave, nunca interpretar un error como éxito.

Precio/spots son snapshots SQL. La subida exige Auth confirmado y propietario, no acepta monto/ruta/usuario del formulario; decodifica archivo y solo entrega una primera transferencia. La transacción fija pago `uploaded` y reserva `payment_review`; únicamente payments/system_admin aprueba. Los reintentos reconocen commit perdido y nunca borran un objeto potencialmente vinculado. Los rechazos no habilitan automáticamente reemplazo.

RLS/EXECUTE y SECURITY DEFINER conservados; búsqueda de funciones con search_path vacío, roles revalidados por RPC, sin escrituras directas de reservas/pagos para usuarios. Las pruebas incluyen aislamiento entre propietarios y negación de operaciones por roles incorrectos. El bucket sigue privado; la revisión emite URL firmada de 60 segundos, no pública. Staff/KRE admin no leen comprobantes ni referencias bancarias.

Se mantiene service-role **solo en servidor** para subir bytes ya validados. Cambiar directamente a uploads con sesión+RLS permitiría que otro cliente autenticado eluda la validación real de contenido: las políticas no decodifican imágenes. Una alternativa requiere cuarentena/validación y promoción confiable, permisos y pruebas reales de Storage. No se eliminan las políticas restrictivas ni se inventa ese contrato durante integración. Custodia de la credencial y eventual rediseño requieren coordinación Gabriel/Carlos/Rodrigo.

## Rutas y matriz de roles

| Ruta | Acceso / comportamiento |
| --- | --- |
| `/` | Redirige a landing KRE |
| `/karting/kartingrentalexperience` | Catálogo real público; sin fallback mock |
| `/karting/kartingrentalexperience/reservar` | Calendario público real |
| `/reservar` | Consulta pública; envío solo con sesión confirmada y gate de pruebas |
| `/reservar/[slotId]` | Adaptador de enlaces históricos a wizard canónico |
| `/reservas/[id]/pago` | Dueño autenticado; envío exige correo confirmado y gate |
| `/mis-reservas`, `/mis-reservas/[id]/qr`, `/mis-reservas/[id]/calendario` | Solo datos propios; QR/ICS según estado pagado/acceso |
| `/staff/check-in`, `/staff/venta` | staff, kre_admin, system_admin |
| `/cobros/verificacion`, `/cobros/verificacion/[id]/comprobante` | payments, system_admin |
| `/admin` | Redirige a eventos; guard allí |
| `/admin/eventos`, `/admin/paquetes` | kre_admin, system_admin |
| `/admin/reportes`, `/admin/reportes/exportar` | payments, kre_admin, system_admin; créditos solo admins |
| `/login`, `/registro`, `/verificar-correo` | Públicas, retorno local `next` conservado |
| `/perfil` | Usuario autenticado, perfil propio |

Pilot no accede a cobros/pista/reportes; staff no aprueba; payments no administra catálogo/emite créditos; kre_admin no revisa comprobantes. Los enlaces no sustituyen guards ni RLS. Los estados loading/error/empty de las rutas operativas provienen del módulo de Rodrigo.

## Validaciones locales

- `npm test`: **98 aprobadas**, cero fallos/omisiones.
- ESLint y TypeScript sin emisión: aprobados.
- `git diff --check`: aprobado.
- PostgreSQL local: **15 escenarios** aprobados con conexiones independientes.
- Visual con fixtures: **10 comprobaciones** aprobadas (cinco rutas × dos anchos).
- `npm audit --omit=dev`: **0 vulnerabilidades**; auditoría completa: cinco alertas de tooling descritas arriba.
- `npm run build` con Next 16.3.8: aprobado, todas las rutas compiladas. El primer intento aislado falló al descargar Google Fonts; el reintento con red terminó correctamente. Permanece el aviso preexistente de un lockfile fuera del repositorio.

Comandos reproducibles desde `pitlane/`, Node 24, sin referencias remotas ni credenciales Supabase para las pruebas:

```sh
npm ci --ignore-scripts
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
npm run test:reservations:local
npm run test:operations:concurrency
npm run test:operations:visual
npm audit --omit=dev
```

La suite funcional pasa sobre todas las migraciones; las carreras de PostgreSQL son **3 de reservas + 12 de operations/comprobantes**, con espera de locks observada. Los runners levantan clústeres locales aleatorios en loopback, los detienen al terminar y conservan carpetas temporales de diagnóstico. PostgreSQL embebido 18 no sustituye verificar la versión del proyecto remoto (config local declara 17).

Visual: cinco pantallas de operations a 360/1440 px sin overflow, con fixtures y menú de Auth simulado; no certifica navegador autenticado ni cámara física. Capturas en `.next/operations-visual/`, no versionadas. Unit/SQL emulan Auth/Storage y no demuestran JWT/PostgREST ni transmisión real de bytes. El build comprueba que existen todas las rutas, no que Supabase remoto tenga sus migraciones.

Se detuvo el servidor Next local preexistente para liberar un módulo nativo bloqueado durante `npm ci`; no se detuvieron procesos ajenos. Puede iniciarse nuevamente con `npm run dev`.

## Staging: configuración externa requerida

No se leyó ni imprimió ningún secreto, no se editó `.env.local`, no se habilitó producción y no se consultó/modificó configuración remota. No se acredita que exista un staging listo. **Gabriel/Carlos deben confirmar el proyecto destinado a pruebas**; no se declara staging al proyecto compartido por decisión del asistente. Preferir proyecto separado.

Configurar en el despliegue de pruebas, con valores reales entregados por el responsable:

| Variable | Requisito |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de pruebas confirmado |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública del mismo proyecto |
| `RESERVATIONS_ENVIRONMENT` | `staging` únicamente allí |
| `RESERVATIONS_TEST_ENABLED` | `true` únicamente allí |
| `RESERVATIONS_TEST_SUPABASE_URL` | Igualdad exacta con la URL pública anterior |
| `PAYMENT_RECEIPTS_TEST_ENABLED` | `true` únicamente allí |
| `SUPABASE_RECEIPT_SERVICE_ROLE_KEY` | Credencial del mismo proyecto; secreto solo servidor, nunca NEXT_PUBLIC/Git |
| `VERCEL_ENV` | No `production`; producción bloquea aun con opt-in |

En hosting propio, el operador debe mantener flags deshabilitados en producción; NODE_ENV=production también se usa para compilar staging. El guard protege el envío por esta app, **no despublica la RPC SQL**. Antes de producción se requiere documento legal definitivo y decisión explícita sobre acceso directo a la RPC y registro legal; no se inventó waiver/versionado.

También se necesita: las diez migraciones verificadas por el responsable, bucket privado y políticas de operations+receipts, roles/grants/schema cache PostgREST, Auth con confirmación de correo, Site URL y Redirect URLs para `/login?next=...` y recuperación de contraseña del host de pruebas, SMTP/Resend o proveedor de correo configurado por Carlos. No se inventan valores ni se envían correos de prueba desde esta tarea.

## Checklist E2E preciso (pendiente en staging)

1. Crear cuentas verificadas pilot A/pilot B, staff, payments, kre_admin y system_admin; una pilot sin confirmar. Roles asignados por administrador autorizado, nunca desde metadata del registro. Usar perfiles/nombres ficticios.
2. Admin crea evento futuro **hoy** con dos tandas posteriores y otra fecha futura; capacidad 10/cuota pista 2. Generar en borrador y publicar. Verificar los tres paquetes oficiales Individual 15/1, Segunda vuelta 10/1 con elegibilidad y Friends 50/5; crear una versión futura solo si se prueba vigencia, conservando snapshots existentes.
3. Visitante elige IDs reales de fecha/tanda/paquete en landing. Pasar login → registro → verificación → login manteniendo `next`. Repetir sin sessionStorage, con enlace manipulado/demo y con correo no confirmado. La selección inválida muestra aviso; no se crea reserva.
4. Pilot A crea Individual y Friends con 1/5 participantes y aceptación temporal explícita. Comprobar `pending_payment`, monto/spots de DB, expires_at anterior a tanda. Doble clic, respuesta perdida y retry: mismo ID; cambiar contenido: nueva clave; no sobreventa.
5. Cargar PNG/JPEG ficticio ≤5 MiB, referencia única y last4. Ver `uploaded`/`payment_review`, objeto privado y mensaje de revisión. Negativos: pilot B/anon, correo no confirmado, PDF/HTML renombrado, truncado/grande, ruta/importe manipulados. Repetir con upload exitoso y corte antes/después de commit; no borrar ni duplicar. Hacer vencer otro hold durante subida/espera; no registrar pago.
6. Payments abre comprobante firmado, aprueba y repite: un pago/una transición a paid. Rechazar otro con motivo y conciliar aprobado; rechazar no habilita reenvío. Staff/kre_admin/pilot B no acceden al comprobante ajeno ni aprueban.
7. Pilot A abre Mis reservas, QR, PNG e ICS. Pilot B intenta los IDs/URLs de A: sin datos. Comprobar fechas UTC−6, monto/participantes y acceso cancelado.
8. Staff escanea QR pagado en teléfono HTTPS o ingresa código; Friends llega 1 + 4, sin duplicados ni herencia de asistencia. Otra tanda/cancelado/no pagado: rechazo. Tras terminar, marcar vuelta completada únicamente de asistentes.
9. Staff vende Individual y Segunda vuelta elegible en la segunda tanda. Precio SQL, efectivo aprobado, idempotencia/QR y ocupación sin descontar doble cuota pista. Intentar Segunda vuelta sin asistencia: rechazo. Competir última plaza web/pista y modificación administrativa: sin sobreventa.
10. Cerrar tanda después del fin: no_show individual, repetir cierre sin duplicar; attended/no_show no liberan venta. Admin emite crédito por reserva pagada con dueño: saldo/origen/motivo correctos, cancelación de acceso, sin duplicación. Walk-in sin cuenta no recibe crédito sin dueño; canje automático sigue pendiente.
11. Reportes y CSV: ingresos transferencia/efectivo, ocupación, asistencias, no_show y créditos coinciden con filas SQL; Friends es un paquete/cinco participantes, no cinco pagos. Comprobar filtros/paginación y permisos payments/kre_admin/staff/pilot.
12. Revisar consola/red, recarga y cambio de cuenta. Registrar fecha, commit, proyecto de pruebas, IDs, rol y evidencia sin secretos ni comprobantes reales. Probar cámara/permisos/denegación en teléfono físico.

## Decisiones humanas y riesgos antes de producción

- Confirmar proyecto de staging, responsable de migraciones e historial real; completar prueba JWT/PostgREST/Storage y revisión cruzada del equipo. No se atribuye ninguna aprobación humana al asistente.
- Documento legal definitivo, texto/versionado/registro de aceptación y habilitación productiva siguen pendientes.
- Acordar propuesta de archivos JPEG/PNG hasta 5 MiB, 16 Mpx, semántica de last4/referencia, cinco intentos, reenvíos tras rechazo y política de retención/limpieza de huérfanos. Nunca borrar objeto vinculado o con finalización en curso.
- Aprobar custodia server-only de service-role o diseñar cuarentena alternativa. Configurar límites HTTP del hosting compatibles con multipart de 5 MiB; un rechazo del proveedor debe seguir siendo error, nunca éxito.
- SMTP/Resend, Redirect URLs y cámara real requieren configuración/prueba externa. No se inventaron datos bancarios.
- Cinco alertas altas de tooling de desarrollo (braces y consumidores), sin corrección compatible ofrecida por npm; producción no presenta alertas en la auditoría ejecutada. No exponer servidores de desarrollo públicamente.
- La rama se propone para revisión de integración, no como certificación de producción o despliegue remoto. El PR #14 permanece abierto; coordinar su cierre al integrar esta rama para evitar un merge duplicado.
