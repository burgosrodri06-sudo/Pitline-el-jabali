import {
  eventDates,
  slots,
  packages,
  SLOT_DURATION,
  MAX_KARTS,
} from "@/app/reservar/booking-data";
import type { Catalog } from "@/domain/events/types";
export const INITIAL_MONTH = eventDates[0]?.date.slice(0, 7) ?? "2026-09";
export const catalog: Catalog = {
  events: eventDates.map((event) => ({
    ...event,
    name: "Karting Rental Experience",
    status: "open",
  })),
  slots: slots.map((slot) => {
    const date = eventDates.find(
      (event) => event.id === slot.eventDateId,
    )!.date;
    const hours = String(Math.floor(slot.startMinutes / 60)).padStart(2, "0");
    const minutes = String(slot.startMinutes % 60).padStart(2, "0");
    return {
      id: slot.id,
      eventId: slot.eventDateId,
      startsAt: `${date}T${hours}:${minutes}:00-06:00`,
      durationMinutes: SLOT_DURATION,
      capacity: MAX_KARTS,
      availableSeats: slot.remainingKarts,
      status: "open",
    };
  }),
  packages: packages.map((item) => ({
    id: item.id,
    name: item.name,
    priceCents: Math.round(item.price * 100),
    participants: item.karts,
    sessionsPerPerson: 1,
    minutesPerSession: SLOT_DURATION,
    active: true,
  })),
};
// Stable Spanish labels avoid ICU differences between server and browser.
export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = {weekday:"long",day:"numeric",month:"long"}) {
 const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
 const weekdays=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
 const value=new Date(`${date}T12:00:00Z`);
 const parts:string[]=[];
 if(options.day) parts.push(String(value.getUTCDate()));
 if(options.month) parts.push(options.month === "short" ? months[value.getUTCMonth()].slice(0,3) : months[value.getUTCMonth()]);
 if(options.year) parts.push(String(value.getUTCFullYear()));
 const body=parts.join(" de ");
 return options.weekday ? weekdays[value.getUTCDay()] + (body ? `, ${body}` : "") : body;
}
export function timeLabel(iso: string) {
  // Mock timestamps are explicitly stored in El Salvador time (UTC-6).
  const hours = Number(iso.slice(11,13));
  const minutes = iso.slice(14,16);
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "p. m." : "a. m."}`;
}
export function bookingHref(
  eventId: string,
  slotId?: string,
  packageId?: string,
) {
  const q = new URLSearchParams({ evento: eventId });
  if (slotId) q.set("tanda", slotId);
  if (packageId) q.set("paquete", packageId);
  return `/reservar?${q}`;
}
