"use client";

import { useRef, useState, type ReactNode } from "react";
import { eventDates, slots, packages, formatDate, formatSlot, formatTime, formatPrice, formatParticipants, MAX_KARTS } from "./booking-data";
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

export default function BookingWizard({ initial = {} }: { initial?: { dateId?: string; slotId?: string; packageId?: string } }) {
  const [step, setStep] = useState(initial.packageId ? 3 : initial.slotId ? 2 : initial.dateId ? 1 : 0);
  const [dateId, setDateId] = useState<string | undefined>(initial.dateId);
  const [slotId, setSlotId] = useState<string | undefined>(initial.slotId);
  const [packageId, setPackageId] = useState<string | undefined>(initial.packageId);
  const [paymentNotice, setPaymentNotice] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const date = eventDates.find((item) => item.id === dateId);
  const slot = slots.find((item) => date && item.id === slotId && item.eventDateId === date.id && item.remainingKarts > 0);
  const selectedPackage = packages.find((item) => item.id === packageId && slot && item.karts <= slot.remainingKarts);
  const accessibleSteps = [true, Boolean(date), Boolean(date && slot), Boolean(date && slot && selectedPackage)];
  const canContinue = [Boolean(date), Boolean(slot), Boolean(selectedPackage), Boolean(date && slot && selectedPackage)][step];

  function goToStep(next: number) {
    if (!accessibleSteps[next]) return;
    setStep(next);
    setPaymentNotice(false);
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

        <p className={styles.mockNotice}><span className={styles.noticeTag}>PROTOTIPO</span> Fechas y disponibilidad simuladas. No se realizan reservas ni cobros.</p>

        <nav aria-label="Etapas de la reserva" className={styles.steps}><ol>
          {steps.map((name, index) => <li key={name}><button type="button" aria-current={step === index ? "step" : undefined} disabled={!accessibleSteps[index]} onClick={() => goToStep(index)}><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><span>{name}</span></button></li>)}
        </ol></nav>

        <div id="booking" className={styles.bookingLayout}>
          <section className={styles.stage} aria-labelledby="stage-title">
            <p className={styles.eyebrow}>PASO {String(step + 1).padStart(2, "0")} / 04</p>
            <h2 ref={headingRef} tabIndex={-1} id="stage-title">{titles[step]}</h2>

            {step === 0 && <><p className={styles.helper}>Seleccioná una de las fechas publicadas para esta experiencia.</p><div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">{eventDates.map((item) => <Choice key={item.id} selected={dateId === item.id} onClick={() => { if (dateId !== item.id) { setDateId(item.id); setSlotId(undefined); setPackageId(undefined); setPaymentNotice(false); } }}><span className={styles.dateLabel}>{formatDate(item.date, true)}</span><span className={styles.choiceMeta}>{item.date.slice(0, 4)} · Desde las 6:00 p. m.</span><span className={styles.choiceStatus}>{dateId === item.id ? "Seleccionada" : "Fecha disponible"}<span aria-hidden="true">↗</span></span></Choice>)}</div><p className={styles.footnote}>Solo operamos en las fechas publicadas de viernes y sábado.</p></>}

            {step === 1 && <><p className={styles.helper}>{date && formatDate(date.date)}. Cada tanda dura 10 minutos.</p><div className={styles.legend}><span>Disponible: 5–10 karts</span><span className={styles.low}>Últimos cupos: 1–4</span><span>Agotada: 0</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{slots.filter((item) => item.eventDateId === dateId).map((item) => <Choice key={item.id} selected={slotId === item.id} disabled={item.remainingKarts === 0} label={`${formatSlot(item)}, ${item.remainingKarts} de ${MAX_KARTS} karts disponibles`} onClick={() => { if (item.remainingKarts > 0 && slotId !== item.id) { setSlotId(item.id); if (!selectedPackage || selectedPackage.karts > item.remainingKarts) setPackageId(undefined); setPaymentNotice(false); } }}><strong className={styles.slotTime}>{formatTime(item.startMinutes)}</strong><span className={`${styles.choiceMeta} ${item.remainingKarts > 0 && item.remainingKarts < 5 ? styles.low : ""}`}>{item.remainingKarts === 0 ? "Agotada · 0 karts" : `${item.remainingKarts} de ${MAX_KARTS} karts libres`}</span><span className={styles.slotStatus}>{slotId === item.id ? "Seleccionada" : item.remainingKarts === 0 ? "Sin cupos" : item.remainingKarts < 5 ? "Últimos cupos" : "Disponible"}</span></Choice>)}</div><p className={styles.footnote}>La última tanda sale a las 11:50 p. m. y termina a medianoche.</p></>}

            {step === 2 && <><p className={styles.helper}>Una tanda, dos formas de disfrutarla. Hay {slot?.remainingKarts} karts disponibles en tu horario.</p><div className="grid gap-4">{packages.map((item) => {
              const unavailable = !slot || item.karts > slot.remainingKarts;
              return <Choice key={item.id} selected={selectedPackage?.id === item.id} disabled={unavailable} onClick={() => { if (!unavailable) { setPackageId(item.id); setPaymentNotice(false); } }}><div className={styles.packageTop}><h3>{item.name}</h3><strong>{formatPrice(item.price)}</strong></div><p className={styles.choiceMeta}>{item.description}</p><span className={styles.packageDetails}>{formatParticipants(item)} · 10 minutos</span><span className={styles.choiceStatus}>{unavailable ? `Necesitás ${item.karts} karts libres. Elegí otra tanda.` : packageId === item.id ? "Seleccionada" : "Elegir experiencia"}</span></Choice>;
            })}</div><p className={styles.footnote}>¿Otra vuelta? La segunda tanda cuesta $10 por persona y solo está disponible después de completar la primera. No se puede agregar a esta reserva inicial.</p></>}

            {step === 3 && <><p className={styles.helper}>Revisá tu selección antes de continuar.</p><div className={styles.review}><span className={styles.eyebrow}>EL JABALÍ / KARTING</span><h3>{selectedPackage?.name}</h3><dl><SummaryRow label="Fecha">{date && formatDate(date.date)}</SummaryRow><SummaryRow label="Tanda">{slot && formatSlot(slot)}</SummaryRow><SummaryRow label="Duración">10 minutos</SummaryRow><SummaryRow label="Cupos seleccionados">{selectedPackage ? formatParticipants(selectedPackage) : "Por elegir"}</SummaryRow><SummaryRow label="Total en USD">{selectedPackage && formatPrice(selectedPackage.price)}</SummaryRow></dl></div><p className={styles.footnote}>Esta selección es de prueba. Los cupos no se apartan y no se solicita información de pago.</p></>}

            <div className={styles.actions}>{step > 0 && <button type="button" className={styles.backButton} onClick={() => goToStep(step - 1)}>← Volver</button>}<button type="button" className={styles.primaryButton} disabled={!canContinue} onClick={() => { if (canContinue) { if (step === 3) setPaymentNotice(true); else goToStep(step + 1); } }}>{step === 3 ? "Continuar al pago" : `Continuar a ${steps[step + 1].toLowerCase()}`}<span aria-hidden="true">→</span></button></div>
            {!canContinue && <p className={styles.footnote}>Seleccioná {step === 0 ? "una fecha" : step === 1 ? "una tanda disponible" : "una experiencia disponible"} para continuar.</p>}
            {paymentNotice && <div role="status" className={styles.paymentNotice}><strong>Hasta aquí llega la prueba.</strong><p>La integración de pago se implementará más adelante. No se ha creado ninguna reserva ni realizado ningún cobro.</p><button type="button" className={styles.backButton} onClick={() => { setDateId(undefined); setSlotId(undefined); setPackageId(undefined); goToStep(0); }}>Probar otra selección →</button></div>}
          </section>

          <aside className={styles.summary} aria-label="Resumen de tu selección"><p className={styles.eyebrow}>TU SALIDA A PISTA</p><h2>Así va tu reserva</h2><dl><SummaryRow label="Fecha">{date ? formatDate(date.date) : "Por elegir"}</SummaryRow><SummaryRow label="Tanda">{slot ? formatSlot(slot) : "Por elegir"}</SummaryRow><SummaryRow label="Experiencia">{selectedPackage?.name ?? "Por elegir"}</SummaryRow><SummaryRow label="Cupos seleccionados">{selectedPackage ? formatParticipants(selectedPackage) : "Por elegir"}</SummaryRow></dl><div className={styles.total}><span>Total <small>USD</small></span><strong className={!selectedPackage ? styles.pendingTotal : undefined}>{selectedPackage ? formatPrice(selectedPackage.price) : "Por definir"}</strong></div><p className={styles.footnote}>10 minutos en pista.<br />Una experiencia que se queda con vos.</p><div className={styles.summaryBottom}>DISPONIBILIDAD SIMULADA</div></aside>
        </div>
      </main>
      <footer className={styles.footer}><span>PITLANE · EL JABALÍ</span><span>Pasión por la pista. El Salvador.</span></footer>
    </div>
  );
}
