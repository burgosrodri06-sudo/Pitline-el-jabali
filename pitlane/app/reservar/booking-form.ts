import type { ReservationParticipantInput } from "../../domain/reservations/types.ts";

/** IDs del catálogo visual temporal; no son el contrato de la futura RPC. */
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
