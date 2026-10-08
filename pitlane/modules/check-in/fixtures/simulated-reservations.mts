import type { CheckInReservation, ReservationStatus } from "../check-in.mjs";

/** Datos ficticios exclusivos de las pruebas; no son reservas ni pagos reales. */
const simulatedBase: CheckInReservation = {
  id: "sim-reservation-1",
  code: "SIM-PAID",
  holderName: "Piloto de prueba",
  seats: 5,
  eventDate: "2026-09-25",
  slotId: "sim-slot-1800",
  status: "paid",
  checkedInAt: null,
};

const blockedStatuses: readonly ReservationStatus[] = [
  "pending_payment", "payment_review", "cancelled", "expired", "no_show", "attended",
];

/** Cada prueba recibe objetos nuevos, sin compartir marcaciones. */
export function createSimulatedReservations(): CheckInReservation[] {
  return [
    { ...simulatedBase },
    ...blockedStatuses.map((status) => ({
      ...simulatedBase,
      id: `sim-${status}`,
      code: `SIM-${status.toUpperCase()}`,
      status,
    })),
    {
      ...simulatedBase,
      id: "sim-already-registered",
      code: "SIM-ALREADY-REGISTERED",
      status: "attended",
      checkedInAt: "2026-09-26T00:00:00.000Z",
    },
  ];
}
