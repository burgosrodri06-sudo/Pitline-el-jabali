# feat: landing KRE y calendario integrado con reservas

La interfaz pública permite consultar fechas, horarios y paquetes antes de
entrar al flujo de reservas. Agrega `/karting/kartingrentalexperience` y los
componentes EventCard, SlotCard y PackageCard con estados de disponibilidad.

Reutiliza el catálogo mock de Gabriel. La fecha, tanda y paquete seleccionados
se transmiten a `/reservar`, se validan y precargan en el wizard existente.
No hay reservas, pagos ni disponibilidad reales.

Build y lint aprobados. Revisar especialmente la inicialización de reservas,
la experiencia móvil y el diseño antes del merge. Requiere las revisiones y
el preview acordados por el equipo.
