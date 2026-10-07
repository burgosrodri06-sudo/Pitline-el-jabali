import type { ReservationParticipantInput } from "../../domain/reservations/types.ts";
import type { EventDate, Slot, Package } from './booking-data.ts';

/** Never translate demo IDs or guess an entity from its name/date. */
export function resolveBookingSelection(
  query: Record<string, string | string[] | undefined>,
  catalog: { eventDates: EventDate[]; slots: Slot[]; packages: Package[] },
): { initial: BookingSelection; invalidSelection: boolean } {
  const date = catalog.eventDates.find(e => typeof query.evento === 'string' && e.id === query.evento);
  const slot = catalog.slots.find(s => date && typeof query.tanda === 'string'
    && s.id === query.tanda && s.eventDateId === date.id && s.remainingKarts > 0);
  const experience = catalog.packages.find(p => slot && date && typeof query.paquete === 'string'
    && p.id === query.paquete && p.karts <= slot.remainingKarts
    && (!p.validFrom || p.validFrom <= date.date) && (!p.validTo || p.validTo >= date.date));
  const invalidSelection = (query.evento !== undefined && !date)
    || (query.tanda !== undefined && !slot) || (query.paquete !== undefined && !experience);
  // Reject the entire inconsistent link instead of silently booking a partial guess.
  return { initial: invalidSelection ? {} : { dateId: date?.id, slotId: slot?.id, packageId: experience?.id }, invalidSelection };
}

/** Selection IDs from the catalog; login return carries no participant PII. */
export type BookingSelection = Readonly<{
  dateId?: string;
  slotId?: string;
  packageId?: string;
}>;

export function resizeParticipants(
  participants: readonly ReservationParticipantInput[],
  count: number,
): ReservationParticipantInput[] {
  return Array.from({ length: count }, (_, index) => ({
    fullName: participants[index]?.fullName ?? "",
  }));
}

/** Retorno fijo a booking; solo IDs, nunca nombres ni aceptación en la URL. */
export function bookingLoginHref(selection: BookingSelection): string {
  const query = new URLSearchParams();
  if (selection.dateId) query.set("evento", selection.dateId);
  if (selection.slotId) query.set("tanda", selection.slotId);
  if (selection.packageId) query.set("paquete", selection.packageId);
  const destination = `/reservar${query.size ? `?${query}` : ""}`;
  return `/login?${new URLSearchParams({ next: destination })}`;
}
