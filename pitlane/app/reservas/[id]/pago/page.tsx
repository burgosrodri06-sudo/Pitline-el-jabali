import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { testBookingEnabled } from '@/domain/reservations/submission';
import { Alert } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { ReservationProgress } from '@/components/ui/reservation-progress';
import { StatusBadge } from '@/components/ui/status';
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
  const expiresLabel = reservation.expires_at ? new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(reservation.expires_at)) : 'No disponible';
  return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
    <PageHeader eyebrow="Pago por transferencia" title="Envía tu comprobante"
      description="Sube la imagen de tu transferencia para que el equipo la revise. Enviar el comprobante no confirma la reserva." />

    <section aria-label="Resumen de la reserva" className="mt-8 rounded-[var(--pl-radius)] border border-line border-t-2 border-t-brand bg-surface p-5 sm:p-6 animate-enter">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtle">Reserva</p>
          <p className="mt-1 font-mono text-xl font-bold tracking-wider">{reservation.code}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtle">Monto a transferir</p>
          <p className="mt-1 font-display text-4xl font-bold tabular-nums">USD {Number(reservation.amount).toFixed(2)}</p>
        </div>
      </div>
      <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">Estado</dt><dd className="mt-1"><StatusBadge status={reservation.status} /></dd></div>
        <div><dt className="text-muted">Vencimiento del apartado</dt><dd className="mt-1 tabular-nums">{expiresLabel}</dd></div>
      </dl>
      <div className="mt-5 border-t border-line pt-5"><ReservationProgress status={reservation.status} /></div>
    </section>

    <Alert tone="warning" className="mt-5">Flujo exclusivo de pruebas. El documento legal definitivo sigue pendiente; la aceptación temporal no es un deslinde oficial aprobado.</Alert>

    <div className="mt-8">
      {!user.email_confirmed_at ? <Alert tone="warning" role="status" title="Confirmá tu correo para enviar el comprobante.">
          <Link className="font-semibold text-brand-text underline underline-offset-4" href="/verificar-correo">Verificar correo</Link>
        </Alert>
        : !enabled ? <Alert tone="info" role="status" title="El envío está deshabilitado." />
        : reservation.status === 'payment_review' ? <Alert tone="info" role="status" title="Comprobante enviado · En revisión">
            Comprobante enviado para revisión. Esto no confirma la reserva ni aprueba el pago.
          </Alert>
        : reservation.status !== 'pending_payment' || expired
          ? <Alert tone="info" role="status" title="Esta reserva no admite una primera entrega de comprobante." />
          : <ReceiptForm reservationId={id} />}
    </div>

    <p className="mt-8 text-sm"><Link className="text-muted underline underline-offset-4 hover:text-ink" href="/mis-reservas">Ver mis reservas</Link></p>
  </main>;
}
