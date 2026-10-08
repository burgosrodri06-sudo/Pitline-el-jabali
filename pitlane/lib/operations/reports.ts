import type { PaymentStatus, ReservationStatus } from "./rules";

/** Proyecciones de dominio devueltas por la RPC autorizada operations_report. */
export type ReportFacts = Readonly<{
  slots: readonly Readonly<{ id: string; capacity: number }>[];
  reservations: readonly Readonly<{
    id: string;
    code: string;
    userId: string | null;
    slotId: string;
    packageId: string;
    status: ReservationStatus;
    spotsRequired: number;
  }>[];
  participants: readonly Readonly<{
    id: string;
    reservationId: string;
    checkedIn: boolean;
    noShow: boolean;
  }>[];
  payments: readonly Readonly<{
    id: string;
    reservationId: string;
    status: PaymentStatus;
    amountCents: number;
    isTrackCash: boolean;
  }>[];
  credits: readonly Readonly<{
    id: string;
    reservationId: string;
    amountCents: number;
  }>[];
}>;

function uniqueById<T extends { id: string }>(
  rows: readonly T[],
): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    if (!row.id || result.has(row.id))
      throw new Error(
        "El reporte contiene filas duplicadas o sin identificador.",
      );
    result.set(row.id, row);
  }
  return result;
}

/**
 * Usa un conjunto completo ya filtrado/autorizado: no hace queries ni pagina datos.
 * Ocupación = cupos pagados / capacidad de las tandas seleccionadas.
 * No-show = ausencias marcadas / (asistencias + ausencias marcadas).
 * Los pagos se cuentan una vez por ID; los créditos se informan por separado.
 */
export function summarizeOperations(facts: ReportFacts) {
  const slots = uniqueById(facts.slots);
  const reservations = uniqueById(facts.reservations);
  uniqueById(facts.participants);
  uniqueById(facts.payments);
  uniqueById(facts.credits);
  let capacity = 0;
  let bookedParticipants = 0;
  let checkedInParticipants = 0;
  let noShowParticipants = 0;
  let webRevenueCents = 0;
  let trackCashRevenueCents = 0;
  let creditsIssuedCents = 0;
  const packagesSold: Record<string, number> = Object.create(null);
  const bookedBySlot = new Map<string, number>();
  const participantsByReservation = new Map<string, number>();
  const isPaid = (status: ReservationStatus) =>
    ["paid", "attended", "no_show"].includes(status);
  const reservationFor = (id: string) => {
    const reservation = reservations.get(id);
    if (!reservation)
      throw new Error("El reporte no incluye la reserva referenciada.");
    return reservation;
  };
  const checkAmount = (amount: number) => {
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new Error("Monto inválido en el reporte.");
  };
  for (const slot of slots.values()) {
    if (
      !Number.isInteger(slot.capacity) ||
      slot.capacity < 1 ||
      slot.capacity > 10
    ) {
      throw new Error("Capacidad inválida en el reporte.");
    }
    capacity += slot.capacity;
  }
  for (const reservation of reservations.values()) {
    if (
      !slots.has(reservation.slotId) ||
      !reservation.packageId ||
      !Number.isInteger(reservation.spotsRequired) ||
      reservation.spotsRequired < 1 ||
      reservation.spotsRequired > 10
    ) {
      throw new Error("Reserva inválida en el reporte.");
    }
    if (!isPaid(reservation.status)) continue;
    bookedParticipants += reservation.spotsRequired;
    packagesSold[reservation.packageId] =
      (packagesSold[reservation.packageId] ?? 0) + 1;
    const booked =
      (bookedBySlot.get(reservation.slotId) ?? 0) + reservation.spotsRequired;
    if (booked > slots.get(reservation.slotId)!.capacity)
      throw new Error("Los cupos exceden la capacidad de la tanda.");
    bookedBySlot.set(reservation.slotId, booked);
  }
  for (const participant of facts.participants) {
    const reservation = reservationFor(participant.reservationId);
    const count = (participantsByReservation.get(reservation.id) ?? 0) + 1;
    participantsByReservation.set(reservation.id, count);
    if (
      count > reservation.spotsRequired ||
      (participant.checkedIn && participant.noShow)
    ) {
      throw new Error("Asistencia inconsistente en el reporte.");
    }
    // Una cancelación por incidente puede ocurrir DESPUÉS de la asistencia.
    // Conservamos ese hecho histórico aunque se emita un crédito posteriormente.
    if (!isPaid(reservation.status) && reservation.status !== "cancelled") {
      if (participant.checkedIn || participant.noShow)
        throw new Error("Asistencia sin reserva pagada.");
      continue;
    }
    if (participant.checkedIn) checkedInParticipants++;
    if (participant.noShow) noShowParticipants++;
  }
  for (const reservation of reservations.values()) {
    if (
      (participantsByReservation.get(reservation.id) ?? 0) !==
      reservation.spotsRequired
    ) {
      throw new Error("Faltan participantes en el reporte.");
    }
  }
  for (const payment of facts.payments) {
    reservationFor(payment.reservationId);
    checkAmount(payment.amountCents);
    if (payment.status !== "approved" && payment.status !== "reconciled")
      continue;
    if (payment.isTrackCash) trackCashRevenueCents += payment.amountCents;
    else webRevenueCents += payment.amountCents;
  }
  for (const credit of facts.credits) {
    reservationFor(credit.reservationId);
    checkAmount(credit.amountCents);
    creditsIssuedCents += credit.amountCents;
  }
  const revenueCents = webRevenueCents + trackCashRevenueCents;
  if (
    ![capacity, bookedParticipants, revenueCents, creditsIssuedCents].every(
      Number.isSafeInteger,
    )
  ) {
    throw new Error("El reporte excede el rango numérico seguro.");
  }
  const attendanceOutcomes = checkedInParticipants + noShowParticipants;
  return {
    capacity,
    bookedParticipants,
    checkedInParticipants,
    noShowParticipants,
    occupancyPercent: capacity ? (bookedParticipants / capacity) * 100 : 0,
    noShowPercent: attendanceOutcomes
      ? (noShowParticipants / attendanceOutcomes) * 100
      : 0,
    revenueCents,
    webRevenueCents,
    trackCashRevenueCents,
    creditsIssuedCents,
    packagesSold,
  };
}

/** CSV para hojas de cálculo: neutraliza fórmulas en campos de texto no confiables. */
export function toOperationsCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  function cell(value: string | number) {
    if (typeof value === "number") {
      if (!Number.isFinite(value))
        throw new Error("El CSV contiene un número inválido.");
      return String(value);
    }
    const safe =
      /^[\s\u0000-\u001f]*[=+@-]/u.test(value) || /^[\t\r\n]/u.test(value)
        ? `'${value}`
        : value;
    return `"${safe.replaceAll('"', '""')}"`;
  }
  if (rows.some((row) => row.length !== headers.length))
    throw new Error("Columnas inconsistentes en el CSV.");
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}
