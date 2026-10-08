import Link from "next/link";
import QRCode from "qrcode";
import type { OperationReservation } from "@/lib/operations/service";
import { operationTime } from '@/lib/operations/service';
import { canDisplayQr } from "@/lib/operations/rules";
import { dateTime, money, StatusBadge, styles, time } from "./ui";
export async function ReservationCard({
  reservation: r,
  track = false,
}: {
  reservation: OperationReservation;
  track?: boolean;
}) {
  const expiredHold = r.status === 'pending_payment' && !!r.expiresAt && Date.parse(r.expiresAt) <= await operationTime();
  const hasAccess =
    canDisplayQr(r.status) &&
    r.slot.status !== "cancelled" &&
    r.slot.eventStatus !== "cancelled";
  const qr = hasAccess
    ? await QRCode.toDataURL(`pitlane:qr:${r.qrToken}`, {
        errorCorrectionLevel: "M",
        margin: 4,
        width: 280,
      })
    : null;
  return (
    <article className={styles.card}>
      <div className={styles.row}>
        <span className={styles.code}>{r.code}</span>
        <StatusBadge status={r.status} />
      </div>
      <h2 style={{ marginTop: 18 }}>{r.packageName}</h2>
      <p>
        {dateTime(r.slot.startsAt)} – {time(r.slot.endsAt)}
      </p>
      <dl className={styles.details}>
        <dt>Participantes</dt>
        <dd>{r.spots}</dd>
        <dt>Total</dt>
        <dd>{money(r.amount)}</dd>
        <dt>Pago</dt>
        <dd>
          {r.payments.length
            ? r.payments.map((p) => (
                <StatusBadge key={p.id} status={p.status} />
              ))
            : "Sin pago registrado"}
        </dd>
      </dl>
      <ul className={styles.list}>
        {r.participants.map((p) => (
          <li key={p.id}>
            {p.fullName}
            {p.attendance?.checkedInAt && (
              <span className={styles.muted}> · Ingresó</span>
            )}
            {p.attendance?.firstRideCompleted && (
              <span className={styles.muted}> · Primera vuelta completada</span>
            )}
          </li>
        ))}
      </ul>
      {r.payments
        .filter((p) => p.rejectionReason)
        .map((p) => (
          <p key={p.id} className={styles.error}>
            Pago rechazado: {p.rejectionReason}
          </p>
        ))}
      {qr && (
        <>
          {/* QR is a locally generated data URL, never an external image request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.qr}
            src={qr}
            width={280}
            height={280}
            alt={`QR de acceso para ${r.code}`}
          />
          <p className={styles.muted}>
            Presenta este QR en pista. El personal verificará la tanda y el
            estado actual de tu reserva.
          </p>
          {!track && (
            <div className={styles.fields}>
              <a
                className={styles.link}
                href={`/mis-reservas/${r.id}/qr`}
                download
              >
                Descargar QR
              </a>
              <a
                className={styles.link}
                href={`/mis-reservas/${r.id}/calendario`}
                download
              >
                Agregar al calendario
              </a>
            </div>
          )}
        </>
      )}
      {expiredHold && <p className={styles.muted}>El plazo del apartado venció. No está confirmado.</p>}
      {!track && r.status === 'pending_payment' && r.payments.length > 0 && <p className={styles.muted}>El reenvío de comprobantes aún no está habilitado. Contacta al equipo para revisar el rechazo.</p>}
      {!track && r.status === "pending_payment" && !expiredHold && r.payments.length === 0 && (
        <Link className={styles.button} href={`/reservas/${r.id}/pago`}>
          Continuar al pago
        </Link>
      )}
    </article>
  );
}
