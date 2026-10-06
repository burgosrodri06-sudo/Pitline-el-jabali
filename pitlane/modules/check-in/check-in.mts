import type { ReservationStatus } from "../../lib/operations/rules.js";
export type { ReservationStatus } from "../../lib/operations/rules.js";

/** Prototipo local de pruebas: no es una fila de Supabase ni un servicio real. */

export type CheckInReservation = Readonly<{
  id: string;
  code: string;
  holderName: string;
  seats: number;
  eventDate: string;
  slotId: string;
  status: ReservationStatus;
  checkedInAt: string | null;
}>;

export type CheckInRequest = Readonly<{
  code: string;
  eventDate: string;
  slotId: string;
}>;

export type Attendance = Readonly<{
  reservationId: string;
  checkedInAt: string;
}>;

export type CheckInResult =
  | Readonly<{
      outcome: "registered" | "already_registered";
      attendance: Attendance;
      holderName: string;
      seats: number;
    }>
  | Readonly<{
      outcome: "rejected";
      reason: "unknown_code" | "reservation_not_paid" | "wrong_date" | "wrong_slot";
    }>;

/**
 * Prototipo síncrono en memoria. Reutilizar la misma instancia conserva las
 * marcaciones; otra instancia o dispositivo tiene un registro independiente.
 * No importa fixtures, no persiste datos y no autentica al personal.
 */
export function createLocalCheckIn(
  reservations: readonly CheckInReservation[],
  clock: () => Date = () => new Date(),
) {
  const byCode = new Map<string, CheckInReservation>();
  const reservationIds = new Set<string>();
  const attendances = new Map<string, Attendance>();

  for (const reservation of reservations) {
    if (byCode.has(reservation.code) || reservationIds.has(reservation.id)) {
      throw new Error("Cada reserva de prueba debe tener un ID y un código únicos.");
    }
    byCode.set(reservation.code, { ...reservation });
    reservationIds.add(reservation.id);
    if (reservation.checkedInAt !== null) {
      attendances.set(reservation.id, {
        reservationId: reservation.id,
        checkedInAt: reservation.checkedInAt,
      });
    }
  }

  function register(request: CheckInRequest): CheckInResult {
    const reservation = byCode.get(request.code);
    if (!reservation) return { outcome: "rejected", reason: "unknown_code" };

    // Repetir una reserva atendida solo puede devolver su marcación existente.
    const previous = attendances.get(reservation.id);
    if (reservation.status !== "paid" && !(reservation.status === "attended" && previous)) {
      return { outcome: "rejected", reason: "reservation_not_paid" };
    }
    if (reservation.eventDate !== request.eventDate) {
      return { outcome: "rejected", reason: "wrong_date" };
    }
    if (reservation.slotId !== request.slotId) {
      return { outcome: "rejected", reason: "wrong_slot" };
    }

    const attendance = previous ?? {
      reservationId: reservation.id,
      checkedInAt: clock().toISOString(),
    };
    if (!previous) attendances.set(reservation.id, attendance);

    return {
      outcome: previous ? "already_registered" : "registered",
      attendance: { ...attendance },
      holderName: reservation.holderName,
      seats: reservation.seats,
    };
  }

  function listAttendance(): Attendance[] {
    return Array.from(attendances.values(), (attendance) => ({ ...attendance }));
  }

  return { register, listAttendance };
}
