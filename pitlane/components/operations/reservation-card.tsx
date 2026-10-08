import Link from "next/link";
import QRCode from "qrcode";
import type { OperationReservation } from "@/lib/operations/service";
import { canDisplayQr } from "@/lib/operations/rules";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { ArrowRight, CalendarDays, Download, Users } from "@/components/ui/icons";
import { ReservationProgress } from "@/components/ui/reservation-progress";
import { dateTime, money, StatusBadge, styles, time } from "./ui";

// Mensaje de "qué sigue" según el estado real. Solo texto; las acciones van aparte.
const nextStep: Partial<Record<OperationReservation["status"], string>> = {
  pending_payment: "Siguiente paso: envía el comprobante de tu transferencia antes de que venza el apartado.",
  payment_review: "Recibimos tu comprobante. El equipo lo está revisando; todavía no es una reserva confirmada.",
  attended: "Vuelta registrada. ¡Gracias por correr en El Jabalí!",
};

export async function ReservationCard({
  reservation: r,
  track = false,
}: {
  reservation: OperationReservation;
  track?: boolean;
}) {
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
  const message = !track ? nextStep[r.status] : undefined;
  return (
    <article className={`${styles.card} animate-enter`}>
      <div className={styles.row}>
        <span className={styles.code}>{r.code}</span>
        <StatusBadge status={r.status} />
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold uppercase leading-tight">
        {r.packageName}
      </h2>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={16} aria-hidden="true" />
          <span className="tabular-nums text-ink">
            {dateTime(r.slot.startsAt)} – {time(r.slot.endsAt)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users size={16} aria-hidden="true" />
          {r.spots} {r.spots === 1 ? "participante" : "participantes"}
        </span>
      </p>
      {!track && (
        <div className="mt-5 border-t border-line pt-4">
          <ReservationProgress status={r.status} />
        </div>
      )}
      {message && <p className="mt-4 text-sm leading-relaxed text-ink">{message}</p>}
      {r.payments
        .filter((p) => p.rejectionReason)
        .map((p) => (
          <Alert key={p.id} tone="danger" className="mt-4">
            Pago rechazado: {p.rejectionReason}
          </Alert>
        ))}
      {!track && r.status === "pending_payment" && (
        <Link className={buttonClass({ block: true, className: `${styles.button} mt-4` })} href={`/reservas/${r.id}/pago`}>
          Continuar al pago <ArrowRight size={18} />
        </Link>
      )}
      {qr && (
        <div className="mt-5 rounded-[var(--pl-radius)] border border-line bg-background p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-success">Acceso a pista</p>
          {/* QR is a locally generated data URL, never an external image request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.qr}
            src={qr}
            width={280}
            height={280}
            alt={`QR de acceso para ${r.code}`}
          />
          <p className="font-mono text-lg font-bold tracking-wider">{r.code}</p>
          <p className={`${styles.muted} mx-auto mt-2 max-w-xs`}>
            Presenta este QR en pista. El personal verificará la tanda y el
            estado actual de tu reserva.
          </p>
          {!track && (
            <div className={`${styles.fields} justify-center`}>
              <a
                className={buttonClass({ variant: "secondary", className: styles.link })}
                href={`/mis-reservas/${r.id}/qr`}
                download
              >
                <Download size={18} /> Descargar QR
              </a>
              <a
                className={buttonClass({ variant: "secondary", className: styles.link })}
                href={`/mis-reservas/${r.id}/calendario`}
                download
              >
                <CalendarDays size={18} /> Agregar al calendario
              </a>
            </div>
          )}
        </div>
      )}
      <details open={track} className="group mt-5 border-t border-line pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-muted hover:text-ink">
          Detalle de la reserva
          <span aria-hidden="true" className="transition-transform duration-[var(--pl-dur)] group-open:rotate-90">
            ›
          </span>
        </summary>
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
      </details>
    </article>
  );
}
