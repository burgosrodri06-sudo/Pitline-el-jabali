import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CreateReservationInput, ReservationReceipt } from "@/domain/reservations/types";
import { isReceipt } from '@/domain/reservations/submission';

const reservationErrors = [
  "authentication_required", "email_verification_required", "invalid_identifiers", "rules_required",
  "invalid_participants", "idempotency_conflict", "event_unavailable",
  "slot_unavailable", "package_unavailable", "participant_count_mismatch",
  "insufficient_capacity", "read_committed_required",
] as const;

export type CreateReservationResult =
  | { ok: true; reservation: ReservationReceipt }
  | { ok: false; error: typeof reservationErrors[number] | "reservation_unavailable" };

/** Called by the booking action with the user's cookie session, never service_role. */
export async function createReservation(input: CreateReservationInput): Promise<CreateReservationResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: 'authentication_required' };
  if (!user.email_confirmed_at) return { ok: false, error: 'email_verification_required' };
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
  const { id, code, status, amount, spots, expiresAt } = data;
  return { ok: true, reservation: { id, code, status, amount, spots, expiresAt } };
}
