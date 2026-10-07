import type { Reservation } from "@/types/database";
export type { ReservationStatus } from "@/types/database";

/** Untrusted input; SQL normalizes names and chooses the first as holder. */
export type ReservationParticipantInput = Readonly<{ fullName: string }>;

/** UI preparation only; no persisted acceptance or reservation. */
export type ReservationPreparation = Readonly<{
  participants: readonly ReservationParticipantInput[];
  waiverAccepted: boolean;
}>;

/** No price, spots, owner, channel, status or timestamps from callers. */
export type CreateReservationInput = Readonly<{
  slotId: string;
  packageId: string;
  idempotencyKey: string;
  participants: readonly ReservationParticipantInput[];
  rulesAccepted: boolean;
}>;

/** Shared schema projection; amount is USD, not cents. */
export type ReservationReceipt = Readonly<Pick<
  Reservation, "id" | "code" | "status" | "amount" | "spots" | "expiresAt"
>>;
