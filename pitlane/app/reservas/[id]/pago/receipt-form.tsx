'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';

const messages: Record<string, string> = {
  receipt_invalid_input: 'Revisá la referencia y los cuatro dígitos antes de enviar.',
  receipt_capacity_unavailable: 'La tanda no tiene capacidad válida. El comprobante no se envió a revisión.',
  receipt_invalid_file: 'Usá una imagen JPEG o PNG válida de hasta 5 MiB. No se admiten documentos PDF.',
  receipt_auth_required: 'Iniciá sesión y confirmá tu correo antes de reintentar.',
  receipt_expired_or_unavailable: 'El apartado venció o la tanda ya no está disponible. No se envió el pago a revisión.',
  receipt_resubmission_blocked: 'Esta reserva ya tiene un pago. Los reenvíos están pendientes de definición por el equipo.',
  receipt_reference_or_attempt_conflict: 'La referencia o el intento ya está registrado. Revisá los datos.',
  receipt_idempotency_conflict: 'Este intento tiene contenido diferente. No se registró otro pago.',
  receipt_attempt_limit: 'Se alcanzó el límite de intentos para esta reserva.',
  receipt_disabled: 'El envío está deshabilitado.',
};

export default function ReceiptForm({ reservationId }: { reservationId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState('');
  const [last4, setLast4] = useState('');
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const attempts = useRef(new Map<string, string>());

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || submitted || !file) return;
    if (file.size > 5 * 1024 * 1024 || file.size === 0) { setMessage(messages.receipt_invalid_file); return; }
    busy.current = true; setPending(true); setMessage('');
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const fingerprint = JSON.stringify([reservationId, reference.trim(), last4,
        Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')]);
      const key = attempts.current.get(fingerprint) ?? crypto.randomUUID();
      attempts.current.set(fingerprint, key);
      const body = new FormData();
      body.set('reservationId', reservationId); body.set('key', key);
      body.set('reference', reference.trim()); body.set('last4', last4); body.set('file', file);
      const response = await fetch('/api/payment-receipts', { method: 'POST', body });
      const result = await response.json();
      if (response.ok && result.submitted === true && typeof result.paymentId === 'string'
        && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(result.paymentId)) {
        setSubmitted(true); setUncertain(false); return;
      }
      if (response.status < 500 && messages[result.error]) {
        setMessage(messages[result.error]); setUncertain(false);
      } else throw new Error('ambiguous');
    } catch {
      setUncertain(true);
      setMessage('No pudimos verificar el resultado. Reintentá con los mismos datos: no se duplicará el pago. No considerés la reserva confirmada.');
    } finally { busy.current = false; setPending(false); }
  }
  if (submitted) return <div role="status"><p>Comprobante enviado para revisión. El pago no está aprobado y la reserva no está confirmada.</p><Link href="/mis-reservas">Consultar estado en Mis reservas</Link></div>;
  return <form onSubmit={send} className="space-y-4">
    <p>Propuesta para pruebas: JPEG/PNG, máximo 5 MiB. Solo primera entrega; reenvíos todavía no habilitados.</p>
    <fieldset disabled={pending || uncertain} className="space-y-4">
      <label className="block">Comprobante <input required type="file" accept="image/jpeg,image/png" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <label className="block">Referencia <input required maxLength={120} value={reference} onChange={e => setReference(e.target.value)} className="border p-2" /></label>
      <label className="block">Últimos cuatro dígitos <input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={last4} onChange={e => setLast4(e.target.value)} className="border p-2" /></label>
    </fieldset>
    <button disabled={pending || !file} className="border p-3" type="submit">{pending ? 'Enviando…' : uncertain ? 'Reintentar el mismo envío' : 'Enviar comprobante para revisión'}</button>
    {message && <p role="alert">{message}</p>}
  </form>;
}
