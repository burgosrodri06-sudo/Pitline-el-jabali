// Catálogo temporal de visualización compartido con KRE. No autoriza reservas:
// se reemplazará al recibir el contrato de Andrés; no agregar datos simulados.
export type EventDate = {
  id: string;
  date: string;
};

export type Slot = {
  id: string;
  eventDateId: string;
  startMinutes: number;
  remainingKarts: number;
  startsAt?: string;
  endsAt?: string;
  capacity?: number;
};

export type Package = {
  id: string;
  name: string;
  price: number;
  karts: number;
  description: string;
  validFrom?: string | null;
  validTo?: string | null;
  durationMinutes?: number;
};

export const SLOT_DURATION = 10;
export const MAX_KARTS = 10;

// Fixed demonstration dates and capacities; no live availability is implied.
export const eventDates: EventDate[] = [
  { id: "sep-25", date: "2026-09-25" },
  { id: "sep-26", date: "2026-09-26" },
  { id: "oct-02", date: "2026-10-02" },
  { id: "oct-03", date: "2026-10-03" },
];

const capacities = [10, 7, 3, 0, 5, 2, 8, 10, 0, 4, 6, 1];

export const slots: Slot[] = eventDates.flatMap((event, dateIndex) =>
  Array.from({ length: 36 }, (_, index) => ({
    id: `${event.id}-${index}`,
    eventDateId: event.id,
    startMinutes: 18 * 60 + index * SLOT_DURATION,
    remainingKarts: capacities[(index + dateIndex * 2) % capacities.length],
  })),
);

export const packages: Package[] = [
  { id: "individual", name: "Individual", price: 15, karts: 1, description: "Tu kart. Tu ritmo. Diez minutos de pura adrenalina." },
  { id: "friends", name: "Combo Amigos", price: 50, karts: 5, description: "Cinco amigos, cinco karts y una misma tanda." },
];

export function formatDate(date: string, short = false) {
  return new Intl.DateTimeFormat("es-SV", {
    weekday: "long", day: "numeric", month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" as const }), timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatTime(minutes: number) {
  if (minutes === 1440) return "12:00 medianoche";
  const hours = Math.floor(minutes / 60);
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, "0")} p. m.`;
}

export function formatSlot(slot: Slot) {
  if (slot.startsAt && slot.endsAt) {
    const format = new Intl.DateTimeFormat('es-SV', { timeZone: 'America/El_Salvador', hour: 'numeric', minute: '2-digit' });
    return `${format.format(new Date(slot.startsAt))} – ${format.format(new Date(slot.endsAt))}`;
  }
  return `${formatTime(slot.startMinutes)} – ${formatTime(slot.startMinutes + SLOT_DURATION)}`;
}

export function formatPrice(price: number) {
  return `$${price.toFixed(2)}`;
}

export function formatParticipants(experience: Package) {
  return experience.karts === 1
    ? "1 kart, 1 participante"
    : `${experience.karts} karts, ${experience.karts} participantes`;
}
