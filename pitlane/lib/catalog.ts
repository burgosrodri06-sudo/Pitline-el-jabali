// Stable Spanish labels avoid ICU differences between server and browser.
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  },
) {
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const weekdays = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  const value = new Date(`${date}T12:00:00Z`);
  const parts: string[] = [];
  if (options.day) parts.push(String(value.getUTCDate()));
  if (options.month)
    parts.push(
      options.month === "short"
        ? months[value.getUTCMonth()].slice(0, 3)
        : months[value.getUTCMonth()],
    );
  if (options.year) parts.push(String(value.getUTCFullYear()));
  const body = parts.join(" de ");
  return options.weekday
    ? weekdays[value.getUTCDay()] + (body ? `, ${body}` : "")
    : body;
}
export function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("es-SV", {
    timeZone: "America/El_Salvador",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
export function bookingHref(
  eventId: string,
  slotId?: string,
  packageId?: string,
) {
  const q = new URLSearchParams({ evento: eventId });
  if (slotId) q.set("tanda", slotId);
  if (packageId) q.set("paquete", packageId);
  return slotId
    ? `/reservar/${slotId}?${q}`
    : "/karting/kartingrentalexperience/reservar";
}
