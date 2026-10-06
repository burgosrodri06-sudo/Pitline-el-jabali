import "server-only";
import { connection } from "next/server";
import { requireAuthenticatedUser, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Attendance,
  Credit,
  Payment,
  PaymentMethod,
  ReservationStatus,
  SlotStatus,
} from "@/types/database";
import { canDisplayQr, operationRoles } from "./rules";
import { summarizeOperations, type ReportFacts } from "./reports";

export class OperationError extends Error {}
export async function operationTime() {
  await connection();
  return Date.now();
}
const messages: Record<string, string> = {
  operations_forbidden: "No tienes permiso para esta operación.",
  operations_insufficient_capacity:
    "La tanda ya no tiene cupos suficientes. Actualiza la disponibilidad.",
  operations_slot_unavailable:
    "La tanda no está habilitada para esta operación o ya terminó.",
  operations_slot_not_finished:
    "Puedes cerrar la asistencia cuando termine la tanda.",
  operations_payment_unavailable:
    "No se encontró una transferencia que puedas revisar.",
  operations_payment_not_approved:
    "El pago debe estar aprobado antes de conciliarlo.",
  operations_payment_not_pending:
    "Este pago ya cambió de estado. Actualiza la bandeja.",
  operations_payment_invalid:
    "Revisa el monto, referencia, últimos cuatro dígitos y comprobante: no coinciden o están incompletos.",
  operations_reason_required: "Escribe un motivo de 1 a 1000 caracteres.",
  operations_reservation_not_paid:
    "No hay una reserva pagada con ese código para la tanda seleccionada.",
  operations_participant_invalid:
    "El participante no corresponde a esta reserva.",
  operations_ride_not_ready:
    "La primera vuelta requiere check-in y que la tanda haya terminado.",
  operations_first_ride_required:
    "Selecciona al participante cuya primera vuelta ya fue completada.",
  operations_package_unavailable: "El paquete no está vigente para esta tanda.",
  operations_idempotency_conflict:
    "Este intento ya se usó con otros datos. Inicia una nueva venta.",
  operations_credit_unavailable:
    "Solo se emiten créditos de reservas pagadas asociadas a una cuenta.",
  operations_credit_exhausted: "El monto pagado ya se acreditó por completo.",
  operations_invalid_range:
    "El rango de reportes debe ser válido y de hasta un año.",
  operations_invalid_input: "Revisa los datos ingresados.",
};
export function databaseError(error: {
  message: string;
  code?: string;
}): never {
  const message = Object.entries(messages).find(([key]) =>
    error.message.includes(key),
  )?.[1];
  throw new OperationError(
    message ??
      (error.code === "23505"
        ? "La operación ya está registrada. Actualiza los datos antes de reintentar."
        : "No se pudo completar la operación. Intenta de nuevo; si persiste, contacta al administrador."),
  );
}
export function uuid(value: string): string {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value))
    throw new OperationError("Identificador inválido.");
  return value;
}
export function localToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/El_Salvador",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function validDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) {
    throw new OperationError("Fecha inválida.");
  }
  return value;
}
type PaymentRow = {
  id: string;
  reservation_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  last4: string | null;
  receipt_path: string | null;
  status: Payment["status"];
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
};
type AttendanceRow = {
  id: string;
  participant_id: string;
  reservation_id: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
  first_ride_completed: boolean;
  first_ride_completed_at: string | null;
  no_show: boolean;
};
type SlotRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: SlotStatus;
  event: { date: string; status: string };
  operation_slot_closures: { closed_at: string } | null;
};
type ParticipantRow = {
  id: string;
  full_name: string;
  is_holder: boolean;
  first_ride_participant_id: string | null;
  attendance: AttendanceRow | null;
};
type ReservationRow = {
  id: string;
  code: string;
  user_id: string | null;
  slot_id: string;
  package_id: string;
  amount: number;
  spots: number;
  status: ReservationStatus;
  qr_token: string;
  created_at: string;
  channel: string;
  slot: SlotRow;
  package: { name: string };
  holder: { full_name: string | null } | null;
  reservation_participants: ParticipantRow[];
  payments: PaymentRow[];
};

const slotColumns =
  "id,starts_at,ends_at,capacity,status,event:events(date,status),operation_slot_closures(closed_at)";
const reservationColumns = `id,code,user_id,slot_id,package_id,amount,spots,status,qr_token,created_at,channel,slot:slots!inner(${slotColumns}),package:packages(name),holder:profiles!reservations_user_id_fkey(full_name),reservation_participants(id,full_name,is_holder,first_ride_participant_id,attendance!attendance_participant_id_fkey(*)),payments(*)`;
function paymentDto(p: PaymentRow): Payment {
  return {
    id: p.id,
    reservationId: p.reservation_id,
    amount: Number(p.amount),
    method: p.method,
    reference: p.reference,
    last4: p.last4,
    receiptPath: p.receipt_path,
    status: p.status,
    reviewedBy: p.reviewed_by,
    reviewedAt: p.reviewed_at,
    rejectionReason: p.rejection_reason,
    createdBy: p.created_by,
    createdAt: p.created_at,
  };
}
function attendanceDto(a: AttendanceRow): Attendance {
  return {
    id: a.id,
    participantId: a.participant_id,
    reservationId: a.reservation_id,
    checkedInAt: a.checked_in_at,
    checkedInBy: a.checked_in_by,
    firstRideCompleted: a.first_ride_completed,
    firstRideCompletedAt: a.first_ride_completed_at,
    noShow: a.no_show,
  };
}
function slotDto(s: SlotRow) {
  return {
    id: s.id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    capacity: s.capacity,
    status: s.status,
    eventDate: s.event.date,
    eventStatus: s.event.status,
    closed: !!s.operation_slot_closures,
  };
}
function reservationDto(r: ReservationRow) {
  return {
    id: r.id,
    code: r.code,
    userId: r.user_id,
    slotId: r.slot_id,
    packageId: r.package_id,
    amount: Number(r.amount),
    spots: r.spots,
    status: r.status,
    qrToken: r.qr_token,
    createdAt: r.created_at,
    channel: r.channel,
    slot: slotDto(r.slot),
    packageName: r.package.name,
    holderName: r.holder?.full_name ?? "Venta en pista",
    participants: r.reservation_participants.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      isHolder: p.is_holder,
      firstRideParticipantId: p.first_ride_participant_id,
      attendance: p.attendance ? attendanceDto(p.attendance) : null,
    })),
    payments: r.payments.map(paymentDto),
  };
}
export type OperationReservation = ReturnType<typeof reservationDto>;
export type OperationSlot = ReturnType<typeof slotDto>;

export async function getMyReservations(page = 1) {
  const user = await requireAuthenticatedUser();
  const db = await createClient();
  const { data, error, count } = await db
    .from("reservations")
    .select(reservationColumns, { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1)
    .returns<ReservationRow[]>();
  if (error) databaseError(error);
  return { reservations: (data ?? []).map(reservationDto), total: count ?? 0 };
}
export async function getMyCredits() {
  const user = await requireAuthenticatedUser();
  const db = await createClient();
  const credits: Credit[] = [];
  for (let start = 0; ; start += 200) {
    const { data, error } = await db
      .from("credits")
      .select("*")
      .eq("user_id", user.id)
      .order("id")
      .range(start, start + 199);
    if (error) databaseError(error);
    for (const c of data ?? [])
      credits.push({
        id: c.id,
        userId: c.user_id,
        originReservationId: c.origin_reservation_id,
        amount: Number(c.amount),
        reason: c.reason,
        usedReservationId: c.used_reservation_id,
        createdAt: c.created_at,
      });
    if (!data || data.length < 200) break;
  }
  return credits;
}
export async function getReservationAccess(id: string, ownerOnly = true) {
  const user = ownerOnly
    ? await requireAuthenticatedUser()
    : (await requireRole(...operationRoles.track)).user;
  const db = await createClient();
  let query = db
    .from("reservations")
    .select(reservationColumns)
    .eq("id", uuid(id));
  if (ownerOnly) query = query.eq("user_id", user.id);
  const { data, error } = await query.returns<ReservationRow[]>().maybeSingle();
  if (error) databaseError(error);
  if (
    !data ||
    !canDisplayQr(data.status) ||
    data.slot.status === "cancelled" ||
    data.slot.event.status === "cancelled"
  )
    return null;
  return reservationDto(data);
}
export async function getPaymentsForReview(
  page = 1,
  status: "uploaded" | "approved" | "reconciled" | "rejected" = "uploaded",
) {
  await requireRole(...operationRoles.payments);
  const db = await createClient();
  const { data, count, error } = await db
    .from("payments")
    .select(`*,reservation:reservations!inner(${reservationColumns})`, {
      count: "exact",
    })
    .eq("method", "bank_transfer")
    .eq("status", status)
    .order("created_at")
    .range((page - 1) * 20, page * 20 - 1)
    .returns<(PaymentRow & { reservation: ReservationRow })[]>();
  if (error) databaseError(error);
  return {
    payments: (data ?? []).map((p) => ({
      ...paymentDto(p),
      reservation: reservationDto(p.reservation),
    })),
    total: count ?? 0,
  };
}
export async function getReceiptUrl(paymentId: string) {
  await requireRole(...operationRoles.payments);
  const db = await createClient();
  const { data, error } = await db
    .from("payments")
    .select("receipt_path")
    .eq("id", uuid(paymentId))
    .eq("method", "bank_transfer")
    .single();
  if (error) databaseError(error);
  if (!data.receipt_path)
    throw new OperationError("Este pago no tiene comprobante.");
  const signed = await db.storage
    .from("payment-receipts")
    .createSignedUrl(data.receipt_path, 60);
  if (signed.error) databaseError(signed.error);
  return signed.data.signedUrl;
}
export async function getOperationSlots(date: string) {
  await requireRole(...operationRoles.track);
  validDate(date);
  const db = await createClient();
  const { data, error } = await db
    .from("slots")
    .select(slotColumns)
    .gte("starts_at", `${date}T00:00:00-06:00`)
    .lte("starts_at", `${date}T23:59:59-06:00`)
    .order("starts_at")
    .limit(200)
    .returns<SlotRow[]>();
  if (error) databaseError(error);
  return (data ?? []).map(slotDto);
}
export async function getSlotAttendance(slotId: string) {
  await requireRole(...operationRoles.track);
  const db = await createClient();
  const { data, error } = await db
    .from("reservations")
    .select(reservationColumns)
    .eq("slot_id", uuid(slotId))
    .in("status", ["paid", "attended", "no_show"])
    .order("code")
    .returns<ReservationRow[]>();
  if (error) databaseError(error);
  return (data ?? []).map(reservationDto);
}
export async function getPackages() {
  await requireAuthenticatedUser();
  const db = await createClient();
  const { data, error } = await db
    .from("packages")
    .select("id,name,price,spots,active,eligibility,valid_from,valid_to")
    .order("name");
  if (error) databaseError(error);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    price: Number(p.price),
    spots: p.spots as number,
    active: p.active as boolean,
    eligibility: p.eligibility as string,
    validFrom: p.valid_from as string | null,
    validTo: p.valid_to as string | null,
  }));
}
export async function getTrackAvailability(slotId: string): Promise<number> {
  await requireRole(...operationRoles.track);
  return rpc<number>("operations_track_availability", {
    p_slot_id: uuid(slotId),
  });
}
export async function getSecondRideCandidates(date: string) {
  await requireRole(...operationRoles.track);
  const slots = await getOperationSlots(date);
  if (!slots.length) return [];
  const db = await createClient();
  const { data, error } = await db
    .from("reservations")
    .select(reservationColumns)
    .in(
      "slot_id",
      slots.map((s) => s.id),
    )
    .in("status", ["paid", "attended"])
    .returns<ReservationRow[]>();
  if (error) databaseError(error);
  return (data ?? []).flatMap((r) =>
    r.reservation_participants
      .filter(
        (p) =>
          !p.first_ride_participant_id &&
          p.attendance?.first_ride_completed &&
          p.attendance.checked_in_at &&
          !p.attendance.no_show,
      )
      .map((p) => ({ id: p.id, fullName: p.full_name, code: r.code })),
  );
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const db = await createClient();
  const { data, error } = await db.rpc(name, args);
  if (error) databaseError(error);
  return data as T;
}
export async function reviewPayment(
  paymentId: string,
  action: string,
  reason: string,
) {
  await requireRole(...operationRoles.payments);
  if (!["approve", "reject", "reconcile"].includes(action))
    throw new OperationError("Acción inválida.");
  return rpc<string>("operations_review_payment", {
    p_payment_id: uuid(paymentId),
    p_action: action,
    p_reason: reason,
  });
}
export async function checkInReservation(
  slotId: string,
  lookup: string,
  participantId: string,
) {
  await requireRole(...operationRoles.track);
  if (!lookup.trim() || lookup.length > 100)
    throw new OperationError("Ingresa un código o QR válido.");
  return rpc<number>("operations_check_in", {
    p_slot_id: uuid(slotId),
    p_lookup: lookup.trim(),
    p_participant_id: participantId ? uuid(participantId) : null,
  });
}
export async function markFirstRideCompleted(participantId: string) {
  await requireRole(...operationRoles.track);
  return rpc<null>("operations_complete_ride", {
    p_participant_id: uuid(participantId),
  });
}
export async function closeSlot(slotId: string) {
  await requireRole(...operationRoles.track);
  return rpc<number>("operations_close_slot", { p_slot_id: uuid(slotId) });
}
export async function createTrackSale(
  slotId: string,
  packageId: string,
  name: string,
  requestId: string,
  firstParticipantId: string,
) {
  await requireRole(...operationRoles.track);
  return rpc<string>("operations_track_sale", {
    p_slot_id: uuid(slotId),
    p_package_id: uuid(packageId),
    p_name: name.trim(),
    p_request_id: uuid(requestId),
    p_first_participant_id: firstParticipantId
      ? uuid(firstParticipantId)
      : null,
  });
}
export async function createCredit(reservationId: string, reason: string) {
  await requireRole("kre_admin", "system_admin");
  return rpc<string>("operations_create_credit", {
    p_reservation_id: uuid(reservationId),
    p_reason: reason,
  });
}
export type ReportFilters = {
  from: string;
  to: string;
  packageId?: string;
  method?: string;
};
export async function getReports(filters: ReportFilters) {
  await requireRole(...operationRoles.reports);
  validDate(filters.from);
  validDate(filters.to);
  if (
    filters.method &&
    !["bank_transfer", "track_cash", "credit"].includes(filters.method)
  )
    throw new OperationError("Método inválido.");
  const facts = await rpc<ReportFacts>("operations_report", {
    p_from: filters.from,
    p_to: filters.to,
    p_package_id: filters.packageId ? uuid(filters.packageId) : null,
    p_method: filters.method || null,
  });
  return { facts, summary: summarizeOperations(facts) };
}
