// Tipos del schema base (supabase/migrations/*_schema_base.sql), en camelCase.
// Fechas y horas llegan como string (ISO); numeric llega como number.
import type { UserRole } from "@/types";

export type EventStatus = "draft" | "open" | "closed" | "cancelled";
export type SlotStatus = "available" | "full" | "closed" | "cancelled";
export type ReservationStatus =
  | "pending_payment"
  | "payment_review"
  | "paid"
  | "cancelled"
  | "expired"
  | "attended"
  | "no_show";
export type PaymentStatus = "pending" | "uploaded" | "approved" | "rejected" | "reconciled";
export type PaymentMethod = "bank_transfer" | "track_cash" | "credit";
export type WaitlistStatus = "waiting" | "offered" | "accepted" | "expired" | "cancelled";
export type PackageEligibility = "none" | "requires_first_ride";
export type ReservationChannel = "web" | "track";

export interface Profile {
  id: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: string;
}

export interface Event {
  id: string;
  date: string;
  status: EventStatus;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  bufferMinutes: number;
  createdBy: string | null;
  createdAt: string;
}

export interface Slot {
  id: string;
  eventId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  trackReservedSpots: number;
  status: SlotStatus;
}

// Vista slot_availability: única fuente de cupos disponibles.
export interface SlotAvailability {
  slotId: string;
  availableSpots: number;
}

export interface Package {
  id: string;
  name: string;
  price: number;
  spots: number;
  durationMinutes: number;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  eligibility: PackageEligibility;
}

export interface Reservation {
  id: string;
  code: string;
  userId: string | null;
  slotId: string;
  packageId: string;
  spots: number;
  amount: number;
  status: ReservationStatus;
  channel: ReservationChannel;
  expiresAt: string | null;
  qrToken: string;
  rulesAcceptedAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ReservationParticipant {
  id: string;
  reservationId: string;
  fullName: string;
  isHolder: boolean;
  firstRideParticipantId: string | null;
}

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  last4: string | null;
  receiptPath: string | null;
  status: PaymentStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  slotId: string;
  userId: string;
  requestedSpots: number;
  status: WaitlistStatus;
  offeredAt: string | null;
  offerExpiresAt: string | null;
  createdAt: string;
}

export interface Attendance {
  id: string;
  participantId: string;
  reservationId: string;
  checkedInAt: string | null;
  checkedInBy: string | null;
  firstRideCompleted: boolean;
  firstRideCompletedAt: string | null;
  noShow: boolean;
}

export interface Credit {
  id: string;
  userId: string;
  originReservationId: string;
  amount: number;
  reason: string;
  usedReservationId: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string | null;
  type: string;
  channel: string;
  status: string;
  error: string | null;
  payload: Record<string, unknown>;
  sentAt: string | null;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}
