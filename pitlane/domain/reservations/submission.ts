import type { CreateReservationInput, ReservationReceipt } from './types.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isReservationInput(value: unknown): value is CreateReservationInput {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return [row.slotId, row.packageId, row.idempotencyKey].every(v => typeof v === 'string' && uuid.test(v))
    && row.rulesAccepted === true && Array.isArray(row.participants)
    && [1, 5].includes(row.participants.length)
    && row.participants.every(p => p && typeof p.fullName === 'string' && p.fullName.trim().length > 0 && p.fullName.trim().length <= 120);
}
export function isReceipt(value: unknown): value is ReservationReceipt {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && uuid.test(row.id)
    && typeof row.code === 'string' && row.code.length > 0
    && typeof row.status === 'string'
    && ['pending_payment', 'payment_review', 'paid', 'cancelled', 'expired', 'attended', 'no_show'].includes(row.status)
    && typeof row.amount === 'number' && Number.isFinite(row.amount) && row.amount > 0
    && typeof row.spots === 'number' && [1, 5].includes(row.spots)
    && typeof row.expiresAt === 'string' && Number.isFinite(Date.parse(row.expiresAt));
}

/** Memory only: retries (including A -> B -> A edits) reuse the original key. */
export function createAttemptKeys(makeKey: () => string = () => crypto.randomUUID()) {
  const keys = new Map<string, string>();
  return (input: Omit<CreateReservationInput, 'idempotencyKey'>) => {
    const content = JSON.stringify([input.slotId, input.packageId, input.rulesAccepted,
      input.participants.map(p => p.fullName.trim())]);
    if (!keys.has(content)) keys.set(content, makeKey());
    return keys.get(content)!;
  };
}

export type SubmissionResult = { ok: true; reservation: ReservationReceipt } | { ok: false; error: string };

export async function runReservationSubmission(input: unknown, enabled: boolean,
  reserve: (input: CreateReservationInput) => Promise<SubmissionResult>): Promise<SubmissionResult> {
  if (!enabled) return { ok: false, error: 'booking_disabled' };
  if (!isReservationInput(input)) return { ok: false, error: 'invalid_input' };
  try {
    const result = await reserve(input);
    if (result.ok && !isReceipt(result.reservation)) return { ok: false, error: 'reservation_unavailable' };
    return result;
  } catch { return { ok: false, error: 'reservation_unavailable' }; }
}

/** Synchronous guard: two clicks before React renders still send once. */
export function createSubmissionRunner(send: (input: CreateReservationInput) => Promise<SubmissionResult>) {
  let pending = false;
  return async (input: CreateReservationInput): Promise<SubmissionResult | null> => {
    if (pending) return null;
    pending = true;
    try { return await runReservationSubmission(input, true, send); }
    finally { pending = false; }
  };
}

/** Explicit server opt-in only for a separately identified test project. */
export function testBookingEnabled(env: Record<string, string | undefined>): boolean {
  return env.RESERVATIONS_ENVIRONMENT === 'staging'
    && env.RESERVATIONS_TEST_ENABLED === 'true'
    && env.VERCEL_ENV !== 'production'
    && Boolean(env.RESERVATIONS_TEST_SUPABASE_URL)
    && env.RESERVATIONS_TEST_SUPABASE_URL === env.NEXT_PUBLIC_SUPABASE_URL;
}

export const reservationMessages: Record<string, string> = {
  booking_disabled: 'Las reservas están deshabilitadas mientras se confirma el documento legal definitivo.',
  authentication_required: 'Tu sesión no es válida. Iniciá sesión y volvé a esta selección.',
  email_verification_required: 'Confirmá tu correo antes de reservar. Después volvé a intentar.',
  insufficient_capacity: 'Ya no hay suficientes cupos. Elegí otra tanda o actualizá la disponibilidad.',
  slot_unavailable: 'Esta tanda ya inició o no está disponible. Elegí otra tanda.',
  event_unavailable: 'El evento ya no está disponible.',
  package_unavailable: 'El paquete ya no está disponible para esta fecha.',
  idempotency_conflict: 'El contenido no coincide con el intento anterior. Revisá la selección.',
  invalid_input: 'Revisá los participantes y aceptá explícitamente las reglas.',
  rules_required: 'Debés aceptar las reglas antes de reservar.',
  participant_count_mismatch: 'La cantidad de participantes no coincide con el paquete.',
  invalid_participants: 'Revisá los nombres de los participantes.',
  reservation_unavailable: 'No pudimos confirmar el resultado. Reintentá sin cambiar los datos: usaremos la misma clave para evitar duplicados. No recargués ni cierres esta pantalla.',
};
