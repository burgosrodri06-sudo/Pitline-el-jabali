"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { CreateReservationInput, ReservationReceipt, ReservationParticipantInput } from "@/domain/reservations/types";
import { PARTICIPANT_NAME_MAX_LENGTH, validateReservationPreparation } from "@/domain/reservations/preparation";
import { bookingLoginHref, resizeParticipants, type BookingSelection } from "./booking-form";
import { formatDate, formatSlot, formatTime, formatPrice, formatParticipants, MAX_KARTS } from "./booking-data";
import type { BookingCatalog } from '@/lib/services/booking-catalog';
import { createAttemptKeys, createSubmissionRunner, isReceipt, reservationMessages } from '@/domain/reservations/submission';
import { submitReservation } from './actions';
import styles from "./booking.module.css";

const steps = ["Fecha", "Tanda", "Experiencia", "Resumen"];
const titles = ["Todo empieza con una fecha.", "Elegí tu salida a pista.", "¿Cómo vas a vivir la pista?", "Tu próxima salida, en detalle."];

function Choice({ selected, disabled, onClick, children, label }: {
  selected: boolean; disabled?: boolean; onClick: () => void; children: ReactNode; label?: string;
}) {
  return <button type="button" className={`${styles.choice} ${selected ? styles.selected : ""}`} aria-pressed={selected} aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.summaryRow}><dt>{label}</dt><dd>{children}</dd></div>;
}

export default function BookingWizard({ initial = {}, principalName = "", authenticated = false, verified = false, catalog, catalogError = false, bookingEnabled = false, invalidSelection = false }: {
  catalog: BookingCatalog;
  catalogError?: boolean;
  invalidSelection?: boolean;
  bookingEnabled?: boolean;
  verified?: boolean;
  initial?: BookingSelection;
  principalName?: string;
  authenticated?: boolean;
}) {
  const { eventDates, slots, packages: allPackages } = catalog;
  const [step, setStep] = useState(initial.packageId ? 3 : initial.slotId ? 2 : initial.dateId ? 1 : 0);
  const [dateId, setDateId] = useState<string | undefined>(initial.dateId);
  const [slotId, setSlotId] = useState<string | undefined>(initial.slotId);
  const [packageId, setPackageId] = useState<string | undefined>(initial.packageId);
  const [participants, setParticipants] = useState<readonly ReservationParticipantInput[]>(() =>
    resizeParticipants([{ fullName: principalName }], allPackages.find(item => item.id === initial.packageId)?.karts ?? 1),
  );
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [touched, setTouched] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReservationReceipt | null>(null);
  const [sending, startTransition] = useTransition();
  const send = useRef(createSubmissionRunner(submitReservation));
  const keys = useRef(createAttemptKeys());
  const lastAttempt = useRef<CreateReservationInput | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const uncertain = error === 'reservation_unavailable';
  const locked = sending || uncertain || Boolean(receipt);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const date = eventDates.find((item) => item.id === dateId);
  const packages = allPackages.filter(p => date && (!p.validFrom || p.validFrom <= date.date) && (!p.validTo || p.validTo >= date.date));
  const slot = slots.find((item) => date && item.id === slotId && item.eventDateId === date.id && item.remainingKarts > 0);
  const selectedPackage = packages.find((item) => item.id === packageId && slot && item.karts <= slot.remainingKarts);
  const preparation = validateReservationPreparation({ participants, waiverAccepted }, selectedPackage?.karts ?? 0);
  const accessibleSteps = [true, Boolean(date), Boolean(date && slot), Boolean(date && slot && selectedPackage)];
  const canContinue = [Boolean(date), Boolean(slot), Boolean(selectedPackage), Boolean(date && slot && selectedPackage && preparation.valid)][step];

  function resetPreparation(count?: number) {
    if (count !== undefined) setParticipants(current => resizeParticipants(current, count));
    setWaiverAccepted(false);
    setTouched({});
    setError(null);
  }

  function reviewPreparation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (receipt) return;
    if (!bookingEnabled) { setError('booking_disabled'); return; }
    let input = uncertain ? lastAttempt.current : null;
    if (!input) {
      if (!date || !slot || !selectedPackage || !preparation.valid) return;
      const content = { slotId: slot.id, packageId: selectedPackage.id, participants: preparation.data.participants, rulesAccepted: true };
      input = { ...content, idempotencyKey: keys.current(content) };
      lastAttempt.current = input;
    }
    const attempt = input;
    startTransition(async () => {
      try {
        const result = await send.current(attempt);
        if (!result) return;
        if (result.ok && isReceipt(result.reservation)) { setReceipt(result.reservation); setError(null); }
        else setError(result.ok ? 'reservation_unavailable' : result.error);
      } catch { setError('reservation_unavailable'); }
      finally { requestAnimationFrame(() => noticeRef.current?.focus()); }
    });
  }

  function goToStep(next: number) {
    if (locked || !accessibleSteps[next]) return;
    setStep(next);
    setError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  return (
    <div lang="es-SV" className={styles.page}>
      <a href="#booking" className={styles.skipLink}>Saltar a la reserva</a>
      <header className={styles.header}>
        <div className={styles.brand}>PIT<span>LANE</span><span className={styles.brandSlash} aria-hidden="true">{"//"}</span></div>
        <div className={styles.venue}>EL JABALÍ<span>Autódromo Internacional · El Salvador</span></div>
      </header>

      <main className={`mx-auto w-full max-w-7xl px-5 py-10 sm:px-10 sm:py-14 ${styles.main}`}>
        <div className={styles.hero}>
          <div><p className={styles.eyebrow}>EXPERIENCIA DE KARTING</p><h1>LA PISTA<br />TE ESPERA<span>.</span></h1><p className={styles.intro}>Elegí tu momento. Reuní a tu equipo. Sentí El Jabalí.</p></div>
          <div className={styles.raceFacts}><span>VIERNES Y SÁBADOS PUBLICADOS</span><strong>6:00 p. m. — medianoche</strong><p>10 minutos por tanda <span aria-hidden="true">/</span> Hasta 10 karts</p></div>
        </div>

        <p className={styles.mockNotice}><span className={styles.noticeTag}>{bookingEnabled ? 'ENTORNO DE PRUEBAS' : 'RESERVAS DESHABILITADAS'}</span> {bookingEnabled ? 'Creación de apartados de prueba. El documento legal definitivo está pendiente; esta aceptación temporal no es un deslinde oficial.' : 'Podés consultar el catálogo. La creación está deshabilitada mientras se confirma el documento legal definitivo.'}</p>
        {catalogError && <p role="alert">No pudimos cargar el catálogo. Intentá recargar la página.</p>}
        {invalidSelection && <p role="status" className={styles.preparationNotice}>El enlace contiene una selección de demostración, inválida o que ya no está disponible. No seleccionamos ni reservamos nada automáticamente. Elegí fecha, tanda y paquete desde el catálogo real de esta página.</p>}
        {!catalogError && eventDates.length === 0 && <p role="status">No hay eventos publicados disponibles.</p>}

        <nav aria-label="Etapas de la reserva" className={styles.steps}><ol>
          {steps.map((name, index) => <li key={name}><button type="button" aria-current={step === index ? "step" : undefined} disabled={locked || !accessibleSteps[index]} onClick={() => goToStep(index)}><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><span>{name}</span></button></li>)}
        </ol></nav>

        <div id="booking" className={styles.bookingLayout}>
          <section className={styles.stage} aria-labelledby="stage-title">
            <p className={styles.eyebrow}>PASO {String(step + 1).padStart(2, "0")} / 04</p>
            <h2 ref={headingRef} tabIndex={-1} id="stage-title">{titles[step]}</h2>

            {step === 0 && <><p className={styles.helper}>Seleccioná una fecha publicada para tu reserva.</p><div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">{eventDates.map((item) => <Choice key={item.id} selected={dateId === item.id} disabled={locked} onClick={() => { if (dateId !== item.id) { setDateId(item.id); setSlotId(undefined); setPackageId(undefined); resetPreparation(1); } }}><span className={styles.dateLabel}>{formatDate(item.date, true)}</span><span className={styles.choiceMeta}>{item.date.slice(0, 4)} · Desde las 6:00 p. m.</span><span className={styles.choiceStatus}>{dateId === item.id ? "Seleccionada" : "Disponible"}<span aria-hidden="true">↗</span></span></Choice>)}</div><p className={styles.footnote}>Solo operamos en las fechas publicadas de viernes y sábado.</p></>}

            {step === 1 && <><p className={styles.helper}>{date && formatDate(date.date)}. Cada tanda dura 10 minutos.</p><div className={styles.legend}><span>Disponible: 5–10 karts</span><span className={styles.low}>Últimos cupos: 1–4</span><span>Agotada: 0</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{slots.filter((item) => item.eventDateId === dateId).map((item) => <Choice key={item.id} selected={slotId === item.id} disabled={locked || item.remainingKarts === 0} label={`${formatSlot(item)}, ${item.remainingKarts} de ${item.capacity ?? MAX_KARTS} karts disponibles`} onClick={() => { if (item.remainingKarts > 0 && slotId !== item.id) { setSlotId(item.id); const clearPackage = !selectedPackage || selectedPackage.karts > item.remainingKarts; if (clearPackage) setPackageId(undefined); resetPreparation(clearPackage ? 1 : undefined); } }}><strong className={styles.slotTime}>{item.startsAt ? new Intl.DateTimeFormat("es-SV", { timeZone: "America/El_Salvador", hour: "numeric", minute: "2-digit" }).format(new Date(item.startsAt)) : formatTime(item.startMinutes)}</strong><span className={`${styles.choiceMeta} ${item.remainingKarts > 0 && item.remainingKarts < 5 ? styles.low : ""}`}>{item.remainingKarts === 0 ? "Agotada · 0 karts" : `${item.remainingKarts} de ${item.capacity ?? MAX_KARTS} karts libres`}</span><span className={styles.slotStatus}>{slotId === item.id ? "Seleccionada" : item.remainingKarts === 0 ? "Sin cupos" : item.remainingKarts < 5 ? "Últimos cupos" : "Disponible"}</span></Choice>)}</div><p className={styles.footnote}>La última tanda sale a las 11:50 p. m. y termina a medianoche.</p></>}

            {step === 2 && <><p className={styles.helper}>Una tanda, dos formas de disfrutarla. Hay {slot?.remainingKarts} karts disponibles en tu horario.</p><div className="grid gap-4">{packages.map((item) => {
              const unavailable = !slot || item.karts > slot.remainingKarts;
              return <Choice key={item.id} selected={selectedPackage?.id === item.id} disabled={locked || unavailable} onClick={() => { if (!unavailable && packageId !== item.id) { setPackageId(item.id); resetPreparation(item.karts); } }}><div className={styles.packageTop}><h3>{item.name}</h3><strong>{formatPrice(item.price)}</strong></div><p className={styles.choiceMeta}>{item.description}</p><span className={styles.packageDetails}>{formatParticipants(item)} · 10 minutos</span><span className={styles.choiceStatus}>{unavailable ? `Necesitás ${item.karts} karts libres. Elegí otra tanda.` : packageId === item.id ? "Seleccionada" : "Elegir experiencia"}</span></Choice>;
            })}</div><p className={styles.footnote}>¿Otra vuelta? La segunda tanda cuesta $10 por persona y solo está disponible después de completar la primera. No se puede agregar a esta reserva inicial.</p></>}

            {step === 3 && <>
              <p className={styles.helper}>Revisá tu selección y completá los participantes.</p>
              <div className={styles.review}><span className={styles.eyebrow}>EL JABALÍ / KARTING</span><h3>{selectedPackage?.name}</h3><dl><SummaryRow label="Fecha">{date && formatDate(date.date)}</SummaryRow><SummaryRow label="Tanda">{slot && formatSlot(slot)}</SummaryRow><SummaryRow label="Duración">10 minutos</SummaryRow><SummaryRow label="Cupos seleccionados">{selectedPackage ? formatParticipants(selectedPackage) : "Por elegir"}</SummaryRow><SummaryRow label="Total en USD">{receipt ? formatPrice(receipt.amount) : selectedPackage && formatPrice(selectedPackage.price)}</SummaryRow></dl></div>
              {!authenticated && <p className={styles.footnote}>
                <Link className={styles.backButton} href={bookingLoginHref({ dateId, slotId, packageId })}>Iniciá sesión para reservar.</Link>
                <br />Se conservarán fecha, tanda y paquete. Los nombres que escribas y la aceptación se perderán al salir; iniciá sesión antes de completarlos.
              </p>}
              <form id="reservation-preparation" onSubmit={reviewPreparation} noValidate>
                <fieldset disabled={locked} className={styles.participants} aria-describedby="participants-help">
                  <legend>Participantes</legend>
                  <p id="participants-help" className={styles.footnote}>
                    {selectedPackage?.karts === 5 ? "Friends Combo: cinco participantes en la misma tanda, incluido el principal." : "Individual: un participante en la tanda."}
                    {authenticated && " Podés corregir el nombre sugerido de tu perfil."}
                  </p>
                  {participants.map((participant, index) => {
                    const error = touched[index] ? preparation.errors.participants[index] : null;
                    return <div className={styles.participantField} key={index}>
                      <label htmlFor={`participant-${index}`}>{index === 0 ? "Participante principal" : `Participante ${index + 1}`} <span aria-hidden="true">*</span></label>
                      <input
                        id={`participant-${index}`}
                        name={`participant-${index}`}
                        type="text"
                        required
                        maxLength={PARTICIPANT_NAME_MAX_LENGTH}
                        autoComplete={index === 0 ? "section-principal name" : "off"}
                        value={participant.fullName}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `participant-${index}-error` : undefined}
                        onBlur={() => setTouched(current => ({ ...current, [index]: true }))}
                        onChange={event => {
                          const fullName = event.target.value;
                          setParticipants(current => current.map((item, position) => position === index ? { fullName } : item));
                          setWaiverAccepted(false);
                          setError(null);
                        }}
                      />
                      {error && <p id={`participant-${index}-error`} className={styles.fieldError}>{error}</p>}
                    </div>;
                  })}
                </fieldset>
                <fieldset disabled={locked} className={styles.waiver} aria-describedby="waiver-help">
                  <legend>Reglas de esta selección</legend>
                  <ul className={styles.rules}>
                    <li>Cada tanda dura 10 minutos.</li>
                    <li>Individual corresponde a un participante; Friends Combo, a cinco participantes en la misma tanda.</li>
                    <li>Completar estos datos no aparta cupos ni confirma una reserva.</li>
                  </ul>
                  <label className={styles.waiverLabel} htmlFor="waiver-accepted">
                    <input id="waiver-accepted" type="checkbox" required checked={waiverAccepted} aria-describedby="waiver-help" onChange={event => { setWaiverAccepted(event.target.checked); setError(null); }} />
                    <span>He leído y acepto las reglas de esta selección.</span>
                  </label>
                  <p id="waiver-help" className={styles.footnote}>El waiver definitivo está pendiente de publicación. Esta aceptación temporal se registra únicamente al crear un apartado de prueba. No es un deslinde oficial aprobado. El flujo productivo permanece deshabilitado.</p>
                </fieldset>
              </form>
              <p id="preparation-help" className={styles.footnote}>Completá todos los nombres y aceptá las reglas para solicitar un apartado pendiente de pago. Se mantienen solo mientras estés en esta pantalla.</p>
            </>}

            <div className={styles.actions}>{step > 0 && <button type="button" className={styles.backButton} onClick={() => goToStep(step - 1)}>← Volver</button>}<button type={step === 3 ? "submit" : "button"} form={step === 3 ? "reservation-preparation" : undefined} aria-describedby={step === 3 ? "preparation-help" : undefined} className={styles.primaryButton} disabled={(!canContinue && !uncertain) || sending || Boolean(receipt) || (step === 3 && (!bookingEnabled || !authenticated))} onClick={() => { if (canContinue && step < 3) goToStep(step + 1); }}>{step === 3 ? (sending ? "Enviando…" : uncertain ? "Reintentar el mismo apartado" : "Crear apartado pendiente de pago") : `Continuar a ${steps[step + 1].toLowerCase()}`}<span aria-hidden="true">→</span></button></div>
            {!canContinue && step < 3 && <p className={styles.footnote}>Seleccioná {step === 0 ? "una fecha" : step === 1 ? "una tanda disponible" : "una experiencia disponible"} para continuar.</p>}
            {authenticated && !verified && !receipt && <p role="status">Confirmá tu correo antes de reservar. <Link href="/verificar-correo" target="_blank" rel="noopener noreferrer">Abrir verificación en otra pestaña</Link>; después reintentá aquí para conservar tus datos.</p>}
            {error && <div ref={noticeRef} tabIndex={-1} role="alert" className={styles.preparationNotice}><p>{reservationMessages[error] ?? reservationMessages.reservation_unavailable}</p>{error === 'authentication_required' && <Link href={bookingLoginHref({ dateId, slotId, packageId })}>Volver a iniciar sesión</Link>}</div>}
            {receipt && <div ref={noticeRef} tabIndex={-1} role="status" className={styles.preparationNotice}>
              <strong>{receipt.status === 'pending_payment' ? 'Apartado pendiente de pago' : 'Estado de tu reserva'}</strong>
              <dl><SummaryRow label="Código">{receipt.code}</SummaryRow><SummaryRow label="Monto real USD">{formatPrice(receipt.amount)}</SummaryRow><SummaryRow label="Estado del backend">{receipt.status}</SummaryRow><SummaryRow label="Vencimiento">{new Intl.DateTimeFormat('es-SV', { timeZone: 'America/El_Salvador', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(receipt.expiresAt!))}</SummaryRow></dl>
              {receipt.status === 'pending_payment' && <p>{now !== null && Date.parse(receipt.expiresAt!) <= now ? 'El plazo del apartado venció. No lo considerés confirmado.' : 'Todavía no está pagado ni confirmado. La carga del comprobante estará disponible en el siguiente bloque.'}</p>}
            </div>}
          </section>

          <aside className={styles.summary} aria-label="Resumen de tu selección"><p className={styles.eyebrow}>TU SALIDA A PISTA</p><h2>Así va tu reserva</h2><dl><SummaryRow label="Fecha">{date ? formatDate(date.date) : "Por elegir"}</SummaryRow><SummaryRow label="Tanda">{slot ? formatSlot(slot) : "Por elegir"}</SummaryRow><SummaryRow label="Experiencia">{selectedPackage?.name ?? "Por elegir"}</SummaryRow><SummaryRow label="Cupos seleccionados">{selectedPackage ? formatParticipants(selectedPackage) : "Por elegir"}</SummaryRow></dl><div className={styles.total}><span>Total <small>USD</small></span><strong className={!selectedPackage ? styles.pendingTotal : undefined}>{receipt ? formatPrice(receipt.amount) : selectedPackage ? formatPrice(selectedPackage.price) : "Por definir"}</strong></div><p className={styles.footnote}>10 minutos en pista.<br />Una experiencia que se queda con vos.</p><div className={styles.summaryBottom}>DISPONIBILIDAD SUJETA A CAMBIOS</div></aside>
        </div>
      </main>
      <footer className={styles.footer}><span>PITLANE · EL JABALÍ</span><span>Pasión por la pista. El Salvador.</span></footer>
    </div>
  );
}
