import { createClient } from '@/lib/supabase/server';
import { testBookingEnabled } from '@/domain/reservations/submission';
import { boundedReceiptForm, normalizeReceipt } from '@/domain/reservations/receipt-file';
import { storePaymentReceipt } from '@/lib/services/payment-receipts';

export const runtime = 'nodejs';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const allowedErrors = new Set(['receipt_disabled', 'receipt_invalid_file', 'receipt_invalid_input',
  'receipt_auth_required', 'receipt_unavailable', 'receipt_expired_or_unavailable', 'receipt_resubmission_blocked',
  'receipt_idempotency_conflict', 'receipt_reference_or_attempt_conflict', 'receipt_attempt_limit', 'receipt_capacity_unavailable']);
const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: Request) {
  if (!testBookingEnabled(process.env) || process.env.PAYMENT_RECEIPTS_TEST_ENABLED !== 'true'
    || !process.env.SUPABASE_RECEIPT_SERVICE_ROLE_KEY) return respond({ error: 'receipt_disabled' }, 403);
  if (request.headers.get('origin') !== new URL(request.url).origin) return respond({ error: 'receipt_auth_required' }, 403);
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user?.email_confirmed_at) return respond({ error: 'receipt_auth_required' }, 401);
    const form = await boundedReceiptForm(request);
    const reservationId = form.get('reservationId'); const key = form.get('key');
    const reference = form.get('reference'); const last4 = form.get('last4'); const file = form.get('file');
    if (typeof reservationId !== 'string' || !uuid.test(reservationId) || typeof key !== 'string' || !uuid.test(key)
      || typeof reference !== 'string' || reference.trim().length < 1 || reference.trim().length > 120
      || typeof last4 !== 'string' || !/^\d{4}$/.test(last4) || !(file instanceof File)) throw new Error('receipt_invalid_input');
    const normalized = await normalizeReceipt(new Uint8Array(await file.arrayBuffer()));
    const result = await storePaymentReceipt({ userId: user.id, reservationId, key,
      reference: reference.trim(), last4, ...normalized });
    return respond(result);
  } catch (error) {
    const message = error instanceof Error && allowedErrors.has(error.message) ? error.message : 'receipt_unavailable';
    return respond({ error: message }, message === 'receipt_unavailable' ? 503 : 400);
  }
}
