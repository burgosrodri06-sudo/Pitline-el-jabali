import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { transferReceipt } from '@/domain/reservations/receipt-transfer';

export async function storePaymentReceipt(input: {
  userId: string; reservationId: string; key: string; reference: string; last4: string; hash: string; bytes: Uint8Array;
}) {
  // Dedicated server secret, never NEXT_PUBLIC or passed to Client Components.
  const secret = process.env.SUPABASE_RECEIPT_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('receipt_disabled');
  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const args = { p_user: input.userId, p_reservation: input.reservationId, p_key: input.key,
    p_hash: input.hash, p_reference: input.reference, p_last4: input.last4 };
  async function rpc(finalize: boolean) {
    const { data, error } = await admin.rpc('prepare_payment_receipt', { ...args, p_finalize: finalize });
    if (error) {
      if (error.code === '23505') throw new Error('receipt_reference_or_attempt_conflict');
      throw new Error(error.message);
    }
    return data;
  }
  return transferReceipt({ prepare: () => rpc(false), finalize: () => rpc(true), uploadOrVerify: async path => {
    const bucket = admin.storage.from('payment-receipts');
    const { error } = await bucket.upload(path, input.bytes, { contentType: 'image/png', upsert: false });
    if (error) {
      // A retry/concurrent call may find the immutable object already uploaded.
      const existing = await bucket.download(path);
      if (existing.error || !existing.data || existing.data.size > 5 * 1024 * 1024) throw new Error('receipt_unavailable');
      const hash = createHash('sha256').update(Buffer.from(await existing.data.arrayBuffer())).digest('hex');
      if (hash !== input.hash) throw new Error('receipt_idempotency_conflict');
    }
  } });
}
