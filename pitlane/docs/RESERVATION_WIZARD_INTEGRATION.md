# Bloque 4 — wizard con motor real

Rama: feature/reservation-wizard-integration, creada desde main c6c5047 con
working tree limpio. No se modifican migraciones ni se aplica SQL remoto.

## Flujo

`/reservar` carga eventos open, tandas available futuras, paquetes iniciales
activos y `slot_availability` desde `lib/services/booking-catalog.ts`. La vista
oficial es la única fuente de cupos; no se resta capacidad en UI. Se filtra
vigencia de paquetes para la fecha seleccionada. Los mocks antiguos permanecen
para KRE, pero no alimentan ni sirven como fallback al wizard real; sus enlaces
con IDs demo no seleccionan entidades reales. Coordinar con Andrés la integración
del calendario KRE; este bloque permite seleccionar el catálogo real en /reservar.

Los parámetros se resuelven únicamente por igualdad de IDs reales y por relación
evento/tanda, capacidad y vigencia de paquete. Un ID demo, parámetro repetido,
desconocido o combinación inválida descarta toda la preselección y muestra un
aviso para elegir desde el catálogo real. No se traducen IDs demo por nombre,
fecha ni precio. KRE y su catálogo no se modifican.

Server Action → servicio existente → create_reservation con cookies del usuario.
La acción valida estructura, UUID y aceptación, y verifica la habilitación en
servidor. El servicio comprueba getUser() y email_confirmed_at; la RPC conserva
sus propias validaciones, autoridad de precio/cupos y RLS. No se usa service_role.

La selección evento/tanda/paquete viaja en el retorno local de login; los nombres
y aceptación no van en la URL. La verificación de correo se abre en otra pestaña
para conservar el formulario original. Al reintentar, el servicio vuelve a
consultar Auth aunque la página hubiera cargado con correo no confirmado.

## Reintentos y resultados

Cada contenido normalizado tiene una clave UUID estable en memoria. Cambiar
tanda/paquete/nombres cambia la clave; regresar al mismo contenido recupera la
original. Un guard síncrono evita dos requests por doble clic antes del render.
Durante envío se bloquean cambios; un resultado ambiguo conserva el intento
exacto, bloquea la edición y permite reintentar incluso si cambió el catálogo.
No recargar/cerrar ante un error ambiguo: claves y datos duran solo en esta
pantalla, no sobreviven navegación/recarga. No se persiste PII ni se utiliza
localStorage como sustituto del backend.

Se muestran falta de cupos, tanda/evento/paquete no disponible, sesión inválida,
correo pendiente y fallo de red. Solo una respuesta validada permite mostrar
código, amount en USD, status y expiresAt reales. Pending_payment se presenta
como apartado pendiente de pago, nunca como confirmado; al vencer el reloj de
la pantalla avisa que el plazo terminó sin inventar un cambio de estado SQL.
La carga del comprobante sigue pendiente.

## Habilitación exclusiva para pruebas

Defaults: cerrado. No se modificó .env.local ni se habilitó el envío.
Únicamente después de identificar un proyecto separado de staging y configurar
su URL/clave pública en la aplicación de pruebas, el operador puede establecer:

```dotenv
RESERVATIONS_ENVIRONMENT=staging
RESERVATIONS_TEST_ENABLED=true
RESERVATIONS_TEST_SUPABASE_URL=<misma URL del proyecto separado que NEXT_PUBLIC_SUPABASE_URL>
```

Son variables de servidor, no NEXT_PUBLIC. Deben coincidir ambas URLs; VERCEL_ENV
production impide el envío aun con opt-in. NODE_ENV=production puede corresponder
a un build de staging, por eso no se usa como identificador del destino. En
alojamiento propio el operador debe mantener estas variables sin habilitar en
producción: el código no puede detectar un proyecto mal etiquetado por su dueño.
Nunca copiar esta configuración al proyecto compartido/productivo.

El aviso temporal permanece visible. No hay texto legal inventado, nuevo waiver
versionado ni reserva configurada como producción. La habilitación protege este
flujo web, no altera la RPC de 3.2 ni sustituye sus permisos: coordinar su exposición
en el proyecto productivo antes de abrir tráfico. Habilitar producción exige un
bloque posterior con documento aprobado y revisión explícita del flujo.

## Validaciones locales

Cierre del bloque: `npm test` (54 pruebas), `npm run lint`, TypeScript sin
emisión, `npm run build` y `git diff --check` aprobados. El build conserva un
aviso del entorno sobre un package-lock.json fuera del repositorio; los tests
conservan el aviso de Node sobre módulos TypeScript sin type=module. Ninguno
impidió las validaciones. No se ejecutó E2E de navegador con Supabase remoto.

Se prueba también la invocación directa del código de la Server Action con
dependencias de infraestructura simuladas: los flags enviados por el navegador
no habilitan el servidor. El servicio real se prueba con Auth simulado para
confirmar rechazo de usuario ausente/correo no confirmado, parámetros RPC
permitidos y proyección de respuesta sin campos adicionales. Se recorren todos
los IDs demo actuales de KRE y el retorno de login con IDs reales.

## Prueba pendiente de JWT/PostgREST en staging

Se inspeccionó configuración local sin imprimir valores: .env.local contiene
solo NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. No hay project-ref
CLI ni configuración explícita de proyecto separado, usuario de prueba o JWT.
La migración existe en el repositorio y se ejecuta en las pruebas locales; no se
pudo acreditar su instalación remota en un entorno de pruebas identificado.
No se llamó create_reservation remoto ni se registraron usuarios ni datos remotos.

Para cerrar el bloqueo se necesita un proyecto de staging identificado con las
migraciones ya aplicadas por su responsable y usuarios de prueba con correo
confirmado. Probar allí login/retorno, correo no verificado, Individual/Friends,
respuesta perdida y retry sin duplicación, RLS entre dos usuarios, última plaza,
vencimiento y creación con JWT real. No usar el bootstrap SQL local en Supabase.

Requisitos concretos del responsable de staging:

1. Proyecto Supabase separado, con las migraciones oficiales y
   `20261006000200_web_reservation_creation.sql` ya aplicadas y registradas.
2. Los tres paquetes oficiales y al menos un evento open con tandas available
   futuras, en la fecha de El Salvador correspondiente y con capacidad para Friends.
3. Dos cuentas de prueba con correo confirmado y una sin confirmar, con sus
   profiles creados por Auth. Configurar confirmación de correo y URLs de
   aplicación/redirección del entorno; no entregar service_role al navegador.
4. Aplicación de pruebas apuntando a la URL y clave pública de ese proyecto,
   con las tres variables de servidor anteriores. Nunca VERCEL_ENV=production.
5. Probar mediante login y cookies reales, comprobar resultado de RPC y lecturas
   RLS de cada cuenta, y registrar evidencias de reintento y expiración. Ninguna
   de estas comprobaciones remotas se da por aprobada con los tests locales.

Tests locales: preparación y retorno de login, motor sobre todas las migraciones
oficiales, gate de staging, validación de entrada/recibo, doble clic, claves de
reintento y errores. Estas pruebas de funciones y DB no son un E2E de navegador
ni una certificación JWT/PostgREST. No se modificó el protocolo SQL de bloqueos.
