# Título propuesto

feat(integration): complete PitLane demo flow across KRE, reservations and operations

# Cuerpo propuesto

## Resumen

Integra la entrega actual de operations/PR #14 (`1386f9d`) sobre main `b35cbea`, conservando el trabajo del equipo. Conecta navegación y continuidad del recorrido KRE → Auth → apartado → comprobante → revisión → Mis reservas/QR → pista/ventas/reportes.

Corrige retorno tras verificación sin sessionStorage, filtros perdidos al pasar por login, selección por UUID, vigencia de paquetes por fecha, Segunda vuelta fuera del checkout inicial, centavos y presentación de apartados vencidos/reenvíos no habilitados. Conserva propietario/correo, snapshots, idempotencia, RLS, bucket privado y protocolo de locks. Incorpora los parches compatibles de Next y Sharp.

## Migraciones y seguridad

No renombra ni modifica SQL histórico. Integra `20261007182818_rodrigo_operations.sql` y `20261008003300_align_operations_capacity_guard.sql`. Se prueban instalación limpia y el orden histórico reportado de receipts antes de operations. No se aplica SQL remoto ni se habilita producción. Service-role permanece exclusivamente servidor para validar contenido antes de subir; reemplazarlo por sesiones sin cuarentena permitiría eludir esa validación.

## Validación local

- 98 tests aprobados sobre todas las migraciones del checkout; ninguna dependencia de ramas remotas.
- ESLint, TypeScript, build Next 16.3.8 y git diff --check aprobados.
- 15 carreras PostgreSQL local: cupos web/pista, Friends, idempotencia, revisión, asistencia, créditos, edición de capacidad y finalización de comprobantes.
- 10 comprobaciones visuales de operations con fixtures a 360/1440 px. No equivalen a E2E autenticado.
- Auditoría de dependencias de producción: cero alertas. Cinco alertas pendientes en tooling ESLint/braces, sin arreglo compatible ofrecido por npm.

## Pendientes externos / revisión

Confirmar staging con Gabriel/Carlos, historial remoto y migraciones; configurar Auth/SMTP/Redirect URLs y secreto servidor del proyecto correcto. Ejecutar JWT/PostgREST, Storage/RLS con sesiones reales, pérdidas de red y cámara física. Documento legal definitivo, política de reenvíos/formatos/retención y custodia de service-role siguen pendientes. Los guards continúan cerrados por defecto.

Revisar permisos y locks entre Andrés/Carlos/Gabriel/Rodrigo. Coordinar el cierre del PR #14 al integrar esta rama: sus commits ya están incluidos. No mergear/desplegar como sustituto de la validación de staging.

Guía completa y checklist E2E: `pitlane/docs/FINAL_INTEGRATION_STATUS.md`.

No se encontró una plantilla de PR versionada en este checkout; se propone esta estructura de resumen, validación y pendientes. Este archivo prepara el PR, no lo publica ni lo mergea.
