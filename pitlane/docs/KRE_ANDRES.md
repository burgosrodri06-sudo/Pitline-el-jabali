# Landing y calendario KRE — Andrés

> Documento histórico del prototipo. El catálogo actual es real y sus enlaces usan UUID hacia `/reservar`; los mocks descritos abajo ya no alimentan la landing. Ver [estado final](FINAL_INTEGRATION_STATUS.md).

Ruta: `/karting/kartingrentalexperience`, dentro de la aplicación `pitlane`.

## Entrega

Landing, calendario mensual, EventCard, SlotCard y PackageCard, estados de carga,
error, fecha vacía y tandas agotadas. Componentes con props tipadas reutilizables.
CSS Modules aislados; sin nuevas dependencias ni cambios en estilos globales.
Se conservan la página inicial, la carpeta demo y el flujo de reservas existente.
El diseño es una propuesta pendiente de aprobación del equipo en Figma.

La oferta se importa de `app/reservar/booking-data.ts`: no hay otro catálogo
independiente. Se mantienen sus 10 minutos, 10 karts y paquetes Individual ($15)
y Combo Amigos ($50, cinco participantes). Son datos de demostración, no una
confirmación de tarifas reales. Los precios/duraciones del primer prototipo se
sustituyeron por los de este repositorio.

## Integración con Gabriel

Únicamente se modifican `app/reservar/page.tsx` y la inicialización del estado de
`booking-wizard.tsx`. Parámetros opcionales: evento, tanda y paquete.
Se comprueba que existan, que la tanda pertenezca a la fecha, que tenga cupos y
que el grupo quepa. Se descartan valores inválidos. El wizard abre el primer
paso pendiente o el resumen si toda la selección es válida. El acceso normal
sin parámetros sigue funcionando desde el paso Fecha.

Ejemplo: `/reservar?evento=sep-25&tanda=sep-25-0&paquete=friends`.
No se envían precios ni información personal por URL, no se apartan cupos ni
se crean pagos. Estas comprobaciones deberán repetirse con datos vigentes en
el motor real y el bloqueo de cupos deberá ser atómico.

## Ejecutar

Desde la carpeta `pitlane`:

```bash
npm ci
npm run dev
```

Abrir http://localhost:3000/karting/kartingrentalexperience .
La portada `/` no cambia; por eso hay que abrir la ruta completa.

## Comprobaciones

`npm run build` incluye comprobación TypeScript. `npm run lint` revisa el código.
Pruebas manuales: fecha sin evento, mes vacío, tanda agotada, Combo Amigos con
menos de cinco cupos, cambio de fecha que borra la tanda, continuidad al resumen,
acceso sin parámetros y parámetros que mezclan fecha y tanda de eventos distintos.
Revisar a 360 px y en computadora. Pendientes Figma, Instagram, dispositivos
físicos, preview de Vercel y revisiones del PR.

Verificación realizada: build y lint aprobados. Navegador Chromium 134 a 1440 y
360 px: selección, insuficiencia de cupos, agotadas, fecha/mes vacíos, continuidad
al resumen y aviso de pago de prueba, parámetros inválidos. Sin errores de
hidratación ni desbordamiento horizontal. Capturas revisadas.
