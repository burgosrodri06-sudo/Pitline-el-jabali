# Calendario KRE y administración de fechas, tandas y paquetes

Entrega de Andrés Montes para revisión del equipo.

## Estado de esta entrega

El código ya está integrado en `main` mediante `3586bce` y `b35cbea`.
Este PR agrega esta guía de revisión; no vuelve a introducir los cambios de implementación.
La rama `docs/entrega-kre-andres` parte del `main` integrado y contiene la entrega completa.

## Cambios incluidos en la entrega

- Calendario conectado a Supabase con disponibilidad real.
- Administración de fechas: crear, editar, publicar, cerrar y cancelar.
- Generación de tandas con capacidad, buffer y cupos para venta en pista.
- Gestión de paquetes, precios, vigencias y activación.
- Permisos administrativos y validaciones para proteger reservas existentes.
- Conexión del calendario con el formulario de reservas del equipo.
- Documentación y pruebas de integración.

## Commits de implementación

| Commit | Sección |
| --- | --- |
| `33ed566` | Base de datos, permisos y validaciones |
| `1b65344` | Servicios de Supabase |
| `4da5f7b` | Administración de fechas, tandas y paquetes |
| `95eb463` | Calendario y disponibilidad real |
| `592da9b` | Documentación |
| `3586bce` | Integración de la rama en main |
| `b35cbea` | Conexión con reservas y adaptación de pruebas |

## Descargar esta rama para revisión

Desde la raíz del repositorio, con los cambios propios guardados:

```powershell
git fetch origin
git switch --track origin/docs/entrega-kre-andres
cd pitlane
npm.cmd install
npm.cmd run dev
```

Si ya existe esa rama localmente, usar `git switch docs/entrega-kre-andres` y `git pull --ff-only`.
También pueden obtener el código de la entrega actualizando `main`.

## Revisar en la aplicación

- `/karting/kartingrentalexperience/reservar`: calendario público.
- `/admin/eventos`: fechas y tandas, requiere `kre_admin` o `system_admin`.
- `/admin/paquetes`: paquetes, requiere `kre_admin` o `system_admin`.

Cada desarrollador necesita su propio `.env.local`. Las credenciales no están en el repositorio.
La migración KRE `20261005180000` ya fue aplicada y registrada en el Supabase compartido `pitlane-dev`; no debe volver a pegarse manualmente allí.

## Validación realizada al integrar

Compilación correcta, revisión de código sin errores y 63 pruebas aprobadas.
La prueba remota de creación, generación, publicación y cancelación se ejecutó con rollback para no dejar datos de prueba.
Esta actualización solo agrega documentación; no altera el funcionamiento validado.
