import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CreateReservationInput, ReservationReceipt } from "@/domain/reservations/types";

const reservationErrors = [
  "authentication_required", "email_verification_required", "invalid_identifiers", "rules_required",
  "invalid_participants", "idempotency_conflict", "event_unavailable",
  "slot_unavailable", "package_unavailable", "participant_count_mismatch",
  "insufficient_capacity", "read_committed_required",
] as const;

export type CreateReservationResult =
  | { ok: true; reservation: ReservationReceipt }
  | { ok: false; error: typeof reservationErrors[number] | "reservation_unavailable" };

function isReceipt(value: unknown): value is ReservationReceipt {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && typeof row.code === "string"
    && typeof row.status === "string"
    && ["pending_payment", "payment_review", "paid", "cancelled", "expired", "attended", "no_show"].includes(row.status)
    && typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount > 0
    && typeof row.spots === "number" && [1, 5].includes(row.spots)
    && typeof row.expiresAt === "string" && Number.isFinite(Date.parse(row.expiresAt));
}

/** No es Server Action: el wizard sigue desconectado. La RPC autoriza y valida. */
export async function createReservation(input: CreateReservationInput): Promise<CreateReservationResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_reservation", {
    p_slot_id: input.slotId,
    p_package_id: input.packageId,
    p_participants: input.participants.map(participant => ({ full_name: participant.fullName })),
    p_idempotency_key: input.idempotencyKey,
    p_rules_accepted: input.rulesAccepted,
  });
  if (error || !isReceipt(data)) {
    return { ok: false, error: reservationErrors.find(code => code === error?.message) ?? "reservation_unavailable" };
  }
  return { ok: true, reservation: data };
}
