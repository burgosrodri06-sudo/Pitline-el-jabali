import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CreateReservationInput, ReservationReceipt } from "@/domain/reservations/types";

const reservationErrors = [
  "authentication_required", "invalid_identifiers", "waiver_required",
  "invalid_participants", "idempotency_conflict", "event_unavailable",
  "slot_unavailable", "package_unavailable", "participant_count_mismatch",
  "waiver_unavailable", "insufficient_capacity",
] as const;

export type CreateReservationResult =
  | { ok: true; reservation: ReservationReceipt }
  | { ok: false; error: typeof reservationErrors[number] | "reservation_unavailable" };

function isReceipt(value: unknown): value is ReservationReceipt {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && typeof row.status === "string"
    && ["pending_payment", "payment_review", "paid", "cancelled", "expired", "attended", "no_show"].includes(row.status)
    && typeof row.price_cents_snapshot === "number" && Number.isInteger(row.price_cents_snapshot) && row.price_cents_snapshot > 0
    && typeof row.spots_snapshot === "number" && Number.isInteger(row.spots_snapshot) && row.spots_snapshot >= 1 && row.spots_snapshot <= 10
    && row.currency === "USD"
    && typeof row.expires_at === "string" && Number.isFinite(Date.parse(row.expires_at));
}

/** No es Server Action: el wizard sigue desconectado. La RPC autoriza y valida. */
export async function createReservation(input: CreateReservationInput): Promise<CreateReservationResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_reservation", {
    p_slot_id: input.slotId,
    p_package_id: input.packageId,
    p_participants: input.participants.map(participant => ({ full_name: participant.fullName })),
    p_idempotency_key: input.idempotencyKey,
    p_waiver_accepted: input.waiverAccepted,
    p_waiver_version: input.waiverVersion,
  });
  if (error || !isReceipt(data)) {
    return { ok: false, error: reservationErrors.find(code => code === error?.message) ?? "reservation_unavailable" };
  }
  return { ok: true, reservation: data };
}
