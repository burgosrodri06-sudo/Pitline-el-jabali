import type { UserRole } from "@/types";

/**
 * Reglas de presentación y prevalidación de la vertical de Rodrigo.
 * No autorizan escrituras: las RPC las aplican con datos actuales de DB,
 * dentro de la misma transacción. No son filas ni contratos SQL provisionales.
 */
import type { ReservationStatus, PaymentStatus } from "@/types/database";
export type {
  ReservationStatus,
  PaymentStatus,
  SlotStatus,
} from "@/types/database";

export const operationRoles = {
  track: ["staff", "kre_admin", "system_admin"],
  payments: ["payments", "system_admin"],
  reports: ["payments", "kre_admin", "system_admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type RuleResult = { ok: true } | { ok: false; reason: string };
const allowed: RuleResult = Object.freeze({ ok: true });
const denied = (reason: string): RuleResult => ({ ok: false, reason });
const validCents = (value: number) => Number.isSafeInteger(value) && value > 0;

export function canAccessOperation(
  role: UserRole,
  area: keyof typeof operationRoles,
): boolean {
  return (operationRoles[area] as readonly UserRole[]).includes(role);
}

export function canDisplayQr(status: ReservationStatus): boolean {
  // Una reserva atendida conserva su comprobante, pero la DB debe impedir reusar el acceso.
  return status === "paid" || status === "attended";
}

export function validatePaymentReview(
  input: Readonly<{
    role: UserRole;
    action: "approve" | "reject" | "reconcile";
    reservationStatus: ReservationStatus;
    paymentStatus: PaymentStatus;
    isTrackCash: boolean;
    amountCents: number;
    reservationTotalCents: number;
    reason?: string;
  }>,
): RuleResult {
  if (!canAccessOperation(input.role, "payments")) return denied("forbidden");
  if (input.isTrackCash) return denied("track_cash_not_reviewable");
  if (
    !validCents(input.amountCents) ||
    !validCents(input.reservationTotalCents)
  ) {
    return denied("invalid_amount");
  }
  if (input.action === "reconcile") {
    if (input.paymentStatus !== "approved")
      return denied("payment_not_approved");
    if (
      !["paid", "attended", "no_show", "cancelled"].includes(
        input.reservationStatus,
      )
    ) {
      return denied("reservation_not_paid");
    }
    return allowed;
  }
  if (
    input.reservationStatus !== "payment_review" ||
    input.paymentStatus !== "uploaded"
  ) {
    return denied("payment_not_pending_review");
  }
  if (input.action === "reject") {
    const reason = input.reason?.trim() ?? "";
    return reason.length >= 1 && reason.length <= 1000
      ? allowed
      : denied("rejection_reason_required");
  }
  return input.amountCents === input.reservationTotalCents
    ? allowed
    : denied("amount_mismatch");
}

export type RideEvidence = Readonly<{
  participantId: string;
  reservationId: string;
  reservationStatus: ReservationStatus;
  checkedInAt: string | null;
  firstRideCompletedAt: string | null;
}>;

export function validateFirstRideCompletion(
  role: UserRole,
  evidence: RideEvidence,
): RuleResult {
  if (!canAccessOperation(role, "track")) return denied("forbidden");
  if (!canDisplayQr(evidence.reservationStatus))
    return denied("reservation_not_paid");
  if (
    !evidence.checkedInAt ||
    !Number.isFinite(Date.parse(evidence.checkedInAt))
  ) {
    return denied("check_in_required");
  }
  if (evidence.firstRideCompletedAt) return denied("ride_already_completed");
  return allowed;
}

/** Se compara un ID estable de participante, nunca un nombre ni el titular del grupo. */
export function validateSecondRide(
  participantId: string,
  evidence: RideEvidence | null,
): RuleResult {
  if (!participantId || !evidence || evidence.participantId !== participantId) {
    return denied("participant_evidence_required");
  }
  if (!canDisplayQr(evidence.reservationStatus))
    return denied("reservation_not_paid");
  const checkedIn = evidence.checkedInAt
    ? Date.parse(evidence.checkedInAt)
    : NaN;
  const completed = evidence.firstRideCompletedAt
    ? Date.parse(evidence.firstRideCompletedAt)
    : NaN;
  if (
    !Number.isFinite(checkedIn) ||
    !Number.isFinite(completed) ||
    completed < checkedIn
  ) {
    return denied("first_ride_not_completed");
  }
  return allowed;
}

/**
 * Calcula el saldo máximo acreditable, no crea créditos ni resuelve concurrencia.
 * La consulta futura debe incluir TODOS los créditos emitidos, incluso los usados.
 */
export function creditableAmountCents(
  payments: readonly Readonly<{
    id: string;
    status: PaymentStatus;
    amountCents: number;
  }>[],
  issuedCredits: readonly Readonly<{ id: string; amountCents: number }>[],
): number {
  const paymentIds = new Set<string>();
  const creditIds = new Set<string>();
  let paid = 0;
  let credited = 0;
  for (const payment of payments) {
    if (
      !payment.id ||
      paymentIds.has(payment.id) ||
      !validCents(payment.amountCents)
    ) {
      throw new Error("Pagos inválidos o duplicados.");
    }
    paymentIds.add(payment.id);
    if (payment.status === "approved" || payment.status === "reconciled")
      paid += payment.amountCents;
  }
  for (const credit of issuedCredits) {
    if (
      !credit.id ||
      creditIds.has(credit.id) ||
      !validCents(credit.amountCents)
    ) {
      throw new Error("Créditos inválidos o duplicados.");
    }
    creditIds.add(credit.id);
    credited += credit.amountCents;
  }
  if (
    !Number.isSafeInteger(paid) ||
    !Number.isSafeInteger(credited) ||
    credited > paid
  ) {
    throw new Error("El crédito excede el monto realmente pagado.");
  }
  return paid - credited;
}
