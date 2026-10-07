import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { testBookingEnabled } from '@/domain/reservations/submission';
import ReceiptForm from './receipt-form';

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/reservas/${id}/pago`)}`);
  const { data: reservation, error } = await client.from('reservations')
    .select('id,code,amount,status,expires_at').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (error || !reservation) notFound();
  const enabled = testBookingEnabled(process.env) && process.env.PAYMENT_RECEIPTS_TEST_ENABLED === 'true'
    && Boolean(process.env.SUPABASE_RECEIPT_SERVICE_ROLE_KEY);
  // Dynamic Server Component (cookies): this is only a per-request UI hint.
  // The final SQL transaction independently rechecks the actual clock.
  // eslint-disable-next-line react-hooks/purity
  const expired = !reservation.expires_at || Date.parse(reservation.expires_at) <= Date.now();
  return <main className="mx-auto max-w-xl space-y-5 p-8">
    <h1 className="text-2xl font-bold">Comprobante de transferencia</h1>
    <p>Reserva {reservation.code} · USD {Number(reservation.amount).toFixed(2)}</p>
    <p>Estado: {reservation.status}. Vencimiento: {reservation.expires_at ? new Intl.DateTimeFormat('es-SV', {
      timeZone: 'America/El_Salvador', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(reservation.expires_at)) : 'No disponible'}.</p>
    <p>Flujo exclusivo de pruebas. El documento legal definitivo sigue pendiente; la aceptación temporal no es un deslinde oficial aprobado.</p>
    {!user.email_confirmed_at ? <p>Confirmá tu correo para enviar el comprobante. <Link href="/verificar-correo">Verificar correo</Link></p>
      : !enabled ? <p>El envío está deshabilitado.</p>
      : reservation.status === 'payment_review' ? <p>Comprobante enviado para revisión. Esto no confirma la reserva ni aprueba el pago.</p>
      : reservation.status !== 'pending_payment' || expired
        ? <p>Esta reserva no admite una primera entrega de comprobante.</p>
        : <ReceiptForm reservationId={id} />}
  </main>;
}
