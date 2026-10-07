# Operación — Rodrigo Burgos

Rama `feature/operations`, actualizada con `main` (`c6c5047`, PR #13 de Gabriel).
Implementación de P-05, P-07, P-08, P-11 y P-12. La migración se entrega por PR;
no se ha aplicado al Supabase compartido ni se ha mergeado a main.

## Funcionalidades

| Ruta | Comportamiento implementado |
| --- | --- |
| `/mis-reservas` | Reservas propias, próximas/historial, participantes, pagos/rechazos, créditos, QR pagado, PNG y calendario ICS. Paginación de 20 reservas. |
| `/cobros/verificacion` | Bandejas por estado; referencia, últimos cuatro dígitos, monto y comprobante privado con URL de 60 segundos. Aprobar, rechazar con motivo y conciliar. |
| `/staff/check-in` | Fecha/tanda, búsqueda por nombre/código, cámara QR o entrada manual, llegada por participante o grupo, primera vuelta, cierre y ausencias. |
| `/staff/venta` | Individual o Segunda vuelta, walk-in, precio de DB, efectivo, bloqueo de cupos, reintentos idempotentes y QR. Tandas de hoy que no hayan iniciado. |
| `/admin/reportes` | Rango/paquete/método, ocupación, asistencia, ausencias, ingresos, paquetes, créditos y CSV. Emisión de crédito por cancelación/incidente. |

Loading, empty y error en las cinco rutas; estilos aislados y diseño adaptable.
No se modificaron header/menú de sesión, landing, estilos globales, autenticación
ni el checkout de otros integrantes.

## Arquitectura y seguridad

- Servicios en `lib/operations/service.ts`, usando `lib/supabase/server.ts`.
  Estados desde `types/database.ts`. Ninguna secret key.
- Páginas, servicios y acciones usan `lib/auth`; las RPC revalidan rol y datos en
  PostgreSQL. El navegador no fija precio, estado, operador ni propietario.
- Pista: `staff`, `kre_admin`, `system_admin`. Pagos: `payments`, `system_admin`.
  Reportes: `payments`, `kre_admin`, `system_admin`. Créditos: `kre_admin`,
  `system_admin`. Piloto: solo sus reservas, pagos, asistencia y créditos.
- RLS y lectura directa sobre reservas, participantes, pagos, asistencia/créditos.
  Escrituras exclusivamente mediante funciones autorizadas.
- Staff/KRE admin no leen referencias bancarias ni comprobantes. Reportes devuelve
  únicamente datos necesarios para métricas mediante RPC autorizada.
- QR `pitlane:qr:<uuid>` usa el token aleatorio del schema base. Cada lectura
  consulta pago, estado y tanda actuales. Una captura no permite entrar después
  de cancelación, cierre operativo o fin de tanda.
- Asistencia única por participante, FK compuesta a su reserva y primera hora
  conservada. Friends admite llegadas parciales. `attended` indica que alguien
  llegó; el detalle es individual.
- Primera vuelta exige check-in, final de tanda y confirmación del operador.
  Segunda vuelta verifica el ID y evidencia real del participante, no su nombre
  ni la vuelta de otro integrante del combo.
- Las operaciones guardan actor/acción en `audit_logs`.

## Migración y capacidad

`20261007182818_rodrigo_operations.sql` se creó con
`npx supabase migration new rodrigo_operations`. Agrega cierre operativo, autor
de créditos/finalización, idempotencia y restricciones de asistencia/pagos.
No recrea tablas del catálogo ni de reservas. Sustituye el archivo de esta rama
`20261005190815_rodrigo_operations.sql`, todavía no mergeado ni aplicado por esta
entrega, para ordenar la migración después de la extensión web ya integrada.

RPC: `operations_review_payment`, `operations_check_in`,
`operations_complete_ride`, `operations_close_slot`, `operations_track_sale`,
`operations_create_credit`, `operations_report`, `operations_track_availability`.

La vista web sigue siendo `slot_availability`. Su función conserva cupos de
`attended/no_show` y evita descontar dos veces las ventas de pista:

```text
web = capacity - web_consumed - max(track_reserved_spots, track_consumed)
pista = capacity - web_consumed - track_consumed
```

Consumen: `payment_review`, `paid`, `attended`, `no_show` y `pending_payment`
vigente. Las retenciones vencidas no consumen. Un trigger bloquea la tanda y
comprueba capacidad en toda asignación. Exige READ COMMITTED. Las RPC de operación
bloquean tanda antes de reserva y pago/asistencia. Gabriel debe respetar ese orden
y la fórmula compartida en su motor; nunca calcular capacidad en React. El motor
integrado `create_reservation` consulta esa función y bloquea la tanda; venta en
pista usa el mismo orden tanda → evento → paquete.

## Créditos y reportes

Crédito = pagos reales aprobados/conciliados menos TODOS los créditos emitidos,
incluidos los usados. Sin vencimiento; asociado a piloto, motivo, reserva y
operador. Emitirlo cancela acceso. Un walk-in sin cuenta no recibe un crédito sin
propietario. Canje automático/reprogramación en checkout queda fuera de esta entrega.

Ocupación = cupos `paid/attended/no_show` / capacidad de las tandas del rango.
Asistencia/ausencias son individuales. No-show % usa solo resultados registrados.
Friends es un paquete y cinco cupos. Ingresos cuentan cada pago aprobado/conciliado
una vez por ID; créditos se muestran aparte, sin confundirlos con reembolsos.
Método `credit` no se vuelve a contar como ingreso de dinero. Reportes usa un
snapshot SQL completo, sin truncamiento por paginación de PostgREST; máximo 366 días.

## Validación reproducible

Desde `pitlane/`, Node 24:

```sh
npm install
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:operations:concurrency
npm run test:operations:visual
```

- Reglas, reportes/CSV, escape de calendario y preservación de horarios UTC-6.
- PostgreSQL embebido/PGlite carga las migraciones reales: RLS, comprobantes
  privados, aprobación → token QR → check-in → primera vuelta → efectivo → reporte,
  Friends parcial, créditos y cierre/no-show.
- PostgreSQL real con conexiones independientes: aprobación única, asistencia
  única, último cupo entre ventas simultáneas, web contra pista y créditos
  simultáneos. Instancia temporal local; no usa credenciales/URL de Supabase ni
  cambia usuarios del sistema. Conserva carpeta temporal para diagnóstico.
- Integración con Gabriel: las 67 pruebas combinadas cargan todas las migraciones.
  Una reserva creada por `create_reservation` llega a aprobación y check-in de
  Rodrigo; solo la entrega del comprobante se prepara como fixture. La carrera
  web/pista usa ambas RPC reales, con espera de bloqueo comprobada.
- Cinco páginas a 360 y 1440 px en Edge headless, sin desbordamiento horizontal.
  `visual-fixtures.mjs` reemplaza servicios SOLO en ese proceso de pruebas; la app
  nunca lo importa. Capturas: `.next/operations-visual/`. Requiere Edge instalado.

La prueba visual usa fixtures, no una sesión end-to-end de Supabase. Cámara y
permisos deben verificarse en el teléfono de pista. Escáner:
[ZXing](https://github.com/zxing-js/browser); generación:
[node-qrcode](https://github.com/soldair/node-qrcode); relaciones:
[Supabase](https://supabase.com/docs/guides/database/joins-and-nesting).

## Integración y despliegue pendientes

Resultados remotos, revisión de Rodrigo a Gabriel y recorrido de aceptación:
[RODRIGO_VALIDACION_REAL.md](./RODRIGO_VALIDACION_REAL.md). El 7 de octubre la
consulta remota confirmó que faltan `operation_slot_closures` e
`idempotency_key`; el acceso de la CLI todavía requiere `supabase login`.

1. Orden acordado: Andrés → Gabriel → Rodrigo. Gabriel ya está en main por PR #13;
   la entrega de Andrés y la revisión cruzada siguen pendientes de confirmar antes
   del merge de Rodrigo. No se fusionan ramas de otros integrantes desde este PR.
2. **Integración local resuelta (7 de octubre):** Gabriel alineó su esquema en
   `abd6142`; esta rama incorpora `main` en `c6c5047`. Se resolvieron los conflictos
   de dependencias/scripts conservando ambas suites. Los fixtures de Auth/Storage
   cubren ambas migraciones y la prueba de capacidad conserva cupos `attended` y
   `no_show`. Pasan 67 pruebas, lint, build con TypeScript y los 5 escenarios de
   concurrencia local.
3. Aplicar la migración mediante el mecanismo de PR/merge del equipo y revisar
   tablas/políticas en Supabase. No crear tablas a mano en el dashboard.
4. Probar con cuentas reales piloto/payments/staff/admin y comprobante de prueba,
   desde `payment_review` hasta QR/check-in/efectivo/reporte. La conexión remota,
   URLs firmadas y Server Actions no se han certificado con esas cuentas.
5. Revisión cruzada con Andrés. El flujo anterior a `payment_review` (calendario,
   reserva y subida de comprobante) sigue perteneciendo a Andrés/Gabriel.

La implementación de Rodrigo está preparada para revisión; esto no declara todo
el proyecto desplegado ni el flujo público integrado y probado en producción.
