import type { CheckInReservation, ReservationStatus } from "../check-in.mjs";

/** Datos ficticios exclusivos de las pruebas; no son reservas ni pagos reales. */
const simulatedBase: CheckInReservation = {
  id: "sim-reservation-1",
  code: "SIM-CONFIRMED",
  holderName: "Piloto de prueba",
  seats: 2,
  eventDate: "2026-09-25",
  slotId: "sim-slot-1800",
  status: "confirmed",
  checkedInAt: null,
};

const blockedStatuses: readonly ReservationStatus[] = [
  "pending", "in_review", "cancelled", "expired",
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
      checkedInAt: "2026-09-26T00:00:00.000Z",
    },
  ];
}
