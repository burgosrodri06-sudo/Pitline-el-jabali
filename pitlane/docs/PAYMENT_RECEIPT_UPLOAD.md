# Bloque 5 — primera entrega privada (solo pruebas)

Rama `feature/payment-receipt-upload`, derivada de `feature/reservation-wizard-integration` en `5bc74cc`. Depende del PR #15, todavía abierto al iniciar este bloque. Mientras no se integre, cualquier PR de este bloque debe apuntar a esa rama, **no a main**. Después de integrarlo, actualizar la base y comprobar que el diff hacia main contiene solo Bloque 5. No se publicó este trabajo ni se ejecutó SQL remoto.

## Contratos y alcance

Se reutilizan `reservations.amount/spots` como snapshots, `payments` y el bucket privado `payment-receipts` del schema compartido. No se modifica ningún archivo de Rodrigo ni se duplica su revisión, sus políticas SELECT o sus URLs firmadas. Se inspeccionó `origin/feature/operations` en `cfc4a9b`, incluida `20261007182818_rodrigo_operations.sql`.

La entrega inserta `bank_transfer/uploaded` con monto de la reserva, referencia, `last4`, ruta privada y autor; la misma transacción pasa la reserva a `payment_review`. Rodrigo conserva aprobación/rechazo/reconciliación. Su aprobación requiere precisamente estos campos y un objeto existente. La referencia mantiene la unicidad global y distinción de mayúsculas del contrato existente; solo se recortan espacios externos. No se inventan datos bancarios.

No hay formatos/tamaños de comprobantes ni contrato de reemplazo definidos en esas ramas (el límite global de Storage no define la regla de negocio). **Propuesta exclusiva de pruebas, pendiente de acuerdo:** JPEG/PNG, entrada y salida hasta 5 MiB, hasta 16 millones de píxeles, referencia 1–120 caracteres, hasta cinco intentos por reserva. Se decodifica la imagen y se emite PNG sin metadatos ni nombre original. PDF/otros formatos, animación y todo reenvío después de existir cualquier pago —incluso rechazado— quedan bloqueados. La UI identifica esta propuesta. Coordinar formatos, límites, semántica de últimos cuatro dígitos, referencias rechazadas, reemplazos y retención antes de habilitar producción.

## Seguridad y transacciones

`POST /api/payment-receipts` verifica habilitación **en servidor**, Origin, sesión mediante `getUser()` y correo confirmado. No acepta monto, propietario o ruta del navegador. La página obtiene la reserva mediante sesión/RLS y filtro explícito de propietario. El multipart tiene un límite de lectura aunque Content-Length falte o sea falso. El resultado no incluye rutas, URLs ni información de otros usuarios.

La carga validada pasa por un cliente **exclusivamente servidor** con `SUPABASE_RECEIPT_SERVICE_ROLE_KEY`. Es una credencial service-role con alcance amplio, no una clave restringida a este bucket; requiere custodia y aprobación de arquitectura con el equipo. Nunca se exporta al cliente. Se eligió esta frontera para que ningún SDK de navegador pueda saltarse la validación de contenido. Las nuevas políticas restrictivas bloquean INSERT/UPDATE/DELETE de `payment-receipts` para anon/authenticated, incluso si existen políticas permisivas. No afectan SELECT de Rodrigo ni otros buckets. Confirmar con el equipo que ningún otro productor de comprobantes necesita escrituras directas antes de aplicar esta migración.

`prepare_payment_receipt` es SECURITY DEFINER con search_path vacío y EXECUTE únicamente para service_role. Recibe el usuario de `getUser`, no del formulario; vuelve a exigir correo confirmado y propiedad. `payment_receipt_attempts` no tiene permisos API de lectura/escritura. Las consultas privadas las realiza el propietario de la función, con filtros explícitos. La clave UUID vincula reserva, usuario, hash del PNG normalizado, referencia y last4; cambios incompatibles se rechazan. Rutas: `<usuario UUID>/<reserva UUID>/<intento UUID>.png`.

Preparación y finalización toman bloqueos en orden **tanda → reserva → pagos (ordenados por UUID) → intento**. Otros módulos deben conservar tanda → reserva → pago y bloquear la tanda antes de modificar ocupación. No se mantienen locks durante la subida HTTP. Finalizar adquiere otra vez los locks, exige READ COMMITTED, reserva web pendiente, plazo vigente, tanda futura/disponible, evento abierto y capacidad no negativa mediante `slot_available_spots()`. El apartado vigente ya consume sus spots: no se descuentan dos veces. Justo antes de cambiar estados vuelve a comprobar el reloj. Nunca revive un apartado vencido. Un ACK idempotente posterior solo acredita la entrega previa, no su aprobación actual.

La creación usa `upsert:false`. Si una subida devuelve error ambiguo, se descarga la ruta interna y se compara el hash antes de finalizar. Un fallo SQL deja el objeto privado y el intento: reintentar verifica el objeto y registra una sola vez. Si SQL confirmó pero la respuesta se perdió, preparar devuelve el paymentId previamente vinculado sin subir ni insertar de nuevo. El cliente bloquea doble clic; conserva la clave para contenido idéntico en la pantalla y congela los campos ante resultado ambiguo. Recargar la página pierde ese estado en memoria, pero la comprobación SQL de pago existente impide duplicación.

La versión de disponibilidad de operations limita el resultado mínimo a cero; su trigger `operations_capacity_guard` vuelve a verificar la asignación al actualizar la reserva y aborta toda la entrega si hay sobreocupación. No se sustituye ni se duplica ese trigger.

**No se elimina ningún objeto automáticamente**, incluso ante error. Una reserva vencida o referencia duplicada puede dejar un objeto huérfano privado. Definir retención y un proceso de limpieza coordinado con Rodrigo: deberá respetar los locks y demostrar que no hay pago vinculado ni finalización en curso. No borrar por un timeout HTTP.

## Habilitación de staging y pendientes reales

No habilitar el proyecto compartido como staging. Provisionar un Supabase separado, aplicar allí todas las migraciones oficiales (y coordinar la de operations para probar revisión), sin SQL remoto desde esta implementación. Crear catálogo y usuarios de prueba con correos confirmados.

Solo en el servidor de ese entorno configurar:

```
NEXT_PUBLIC_SUPABASE_URL=<URL del proyecto separado>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave pública de ese proyecto>
RESERVATIONS_ENVIRONMENT=staging
RESERVATIONS_TEST_ENABLED=true
RESERVATIONS_TEST_SUPABASE_URL=<la misma URL exacta>
PAYMENT_RECEIPTS_TEST_ENABLED=true
SUPABASE_RECEIPT_SERVICE_ROLE_KEY=<service-role del mismo proyecto, secreto servidor>
```

VERCEL_ENV=production siempre bloquea el envío. Fuera de Vercel, mantener el entorno de producción sin flags ni credencial de pruebas; la clasificación staging debe gestionarse en el despliegue. No configurar ninguna de estas excepciones para el proyecto compartido. El documento legal definitivo y habilitación productiva siguen pendientes.

## Verificación

Resultado local de este bloque: **63 tests aprobados**, ESLint aprobado, `npx tsc --noEmit` aprobado y build Next aprobado. No equivalen a una certificación de staging. npm informó siete alertas altas al actualizar el lockfile; no se ejecutó `audit fix` ni se actualizaron dependencias ajenas al bloque. Sharp ya estaba instalado transitivamente y ahora queda fijado como dependencia directa.

Pruebas locales: suite del motor sobre todas las migraciones oficiales (incluidos los tres paquetes), contenido real de archivos, propiedad/correo, permisos RPC/tabla/Storage, idempotencia y cambios de contenido, expiración durante carga, referencia duplicada, objeto ausente, capacidad inválida, pérdida de respuesta y compatibilidad de aprobación con la migración leída de la referencia local `origin/feature/operations`. PGlite emula Auth/Storage; no es una prueba de JWT, bytes remotos ni concurrencia entre conexiones. La prueba de compatibilidad requiere esa referencia de Git disponible.

Staging pendiente: JWT/cookies/Origin detrás del proxy real, HTTP multipart/límites del proveedor, Storage privado y políticas con JWT piloto/otro usuario/anon/payments, clave servidor del proyecto correcto, archivos reales y URLs firmadas de revisión, dos entregas simultáneas, cupos con otros módulos, expiración mientras sube, desconexión después de subir y después de commit SQL. Rechazar revisiones/reenvíos fuera del contrato. Confirmar que ningún secreto o URL pública aparece en respuesta, bundle o logs. No se ejecutaron estas pruebas contra Supabase compartido.

Referencias: [uploads sin upsert](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [service-role evita RLS](https://supabase.com/docs/guides/storage/security/access-control), [decodificación y límites de Sharp](https://sharp.pixelplumbing.com/api-constructor/).
