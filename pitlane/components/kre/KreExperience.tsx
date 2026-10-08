"use client";
import { cx } from "./styles";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Flag,
  CalendarDays,
  Clock3,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "@/components/ui/icons";
import type { Catalog } from "@/domain/events/types";
import { bookingHref, dateLabel, timeLabel } from "@/lib/catalog";
import { EventCard } from "./EventCard";
import { SlotCard } from "./SlotCard";
import { PackageCard } from "./PackageCard";
export function KreExperience({ catalog }: { catalog: Catalog }) {
  const initialMonth =
    catalog.events[0]?.date.slice(0, 7) ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/El_Salvador",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .slice(0, 7);
  const [month, setMonth] = useState(initialMonth);
  const [date, setDate] = useState(
    catalog.events[0]?.date ?? `${initialMonth}-01`,
  );
  const [slotId, setSlotId] = useState<string>();
  const [packageId, setPackageId] = useState<string>();
  const event = catalog.events.find((e) => e.date === date);
  const slots = catalog.slots.filter((s) => s.eventId === event?.id);
  const slot = slots.find((s) => s.id === slotId);
  const pack = catalog.packages.find((p) => p.id === packageId);
  const [year, mon] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7;
  const monthEvents = catalog.events.filter((e) => e.date.startsWith(month));
  function chooseDate(value: string) {
    setDate(value);
    setSlotId(undefined);
  }
  function changeMonth(delta: number) {
    const next = new Date(Date.UTC(year, mon - 1 + delta, 1))
      .toISOString()
      .slice(0, 7);
    setMonth(next);
    chooseDate(`${next}-01`);
  }
  const canContinue =
    event?.status === "open" &&
    slot?.status === "open" &&
    slot.availableSeats > 0 &&
    (!pack || slot.availableSeats >= pack.participants);
  return (
    <div lang="es-SV" className={cx("root")}>
      <a className={cx("skip-link")} href="#contenido">
        Saltar al contenido
      </a>
      <div className={cx("demo-banner")}>
        KARTING RENTAL EXPERIENCE · Fechas y cupos publicados por ACES.
      </div>
      <main id="contenido">
        <section id="experiencia" className={cx("hero wrap")}>
          <div className={cx("hero-copy")}>
            <p className={cx("eyebrow")}>
              <span className={cx("red-line")} /> KARTING RENTAL EXPERIENCE
            </p>
            <h1>
              TU PRÓXIMA
              <br />
              VUELTA
              <br />
              <em>EMPIEZA AQUÍ.</em>
            </h1>
            <p className={cx("hero-description")}>
              Una noche diferente en El Jabalí.
              <br />
              Descubre la experiencia, encuentra tu fecha y comparte la pista.
            </p>
            <div className={cx("hero-actions")}>
              <Link href="/reservar" className={cx("button button-lg")}>
                Reservar <ArrowRight size={19} />
              </Link>
              <a href="#calendario" className={cx("button-ghost")}>
                <CalendarDays size={18} /> Explorar fechas
              </a>
            </div>
            <div className={cx("hero-location")}>
              <MapPin size={16} /> Autódromo Internacional El Jabalí
            </div>
          </div>
          <div className={cx("hero-art")} aria-hidden="true">
            <div className={cx("art-grid")} />
            <span className={cx("art-label")}>EL JABALÍ / NIGHT SESSION</span>
            <svg viewBox="0 0 500 500" className={cx("track-art")}>
              <path
                d="M100 390 L100 160 Q100 95 170 95 L350 95 Q415 95 415 160 L415 205 Q415 245 365 245 L270 245 Q230 245 230 285 L230 320 Q230 350 280 350 L365 350 Q420 350 420 400 Q420 450 355 450 L155 450 Q100 450 100 390Z"
                fill="none"
                stroke="#282828"
                strokeWidth="62"
              />
              <path
                d="M100 390 L100 160 Q100 95 170 95 L350 95 Q415 95 415 160 L415 205 Q415 245 365 245 L270 245 Q230 245 230 285 L230 320 Q230 350 280 350 L365 350 Q420 350 420 400 Q420 450 355 450 L155 450 Q100 450 100 390Z"
                fill="none"
                stroke="#666"
                strokeWidth="2"
                strokeDasharray="10 12"
              />
              <path
                d="M100 350 L100 160 Q100 95 170 95 L280 95"
                fill="none"
                stroke="#C8102E"
                strokeWidth="9"
              />
              <circle cx="280" cy="95" r="12" fill="#F4F4F4" />
            </svg>
            <div className={cx("art-title")}>
              KRE<span>DESPUÉS DEL ATARDECER.</span>
            </div>
            <span className={cx("art-note")}>
              ILUSTRACIÓN CONCEPTUAL · NO ES EL TRAZADO REAL
            </span>
          </div>
        </section>
        <div className={cx("facts")}>
          <div className={cx("wrap facts-inner")}>
            <span>
              <Flag /> Una experiencia para compartir
            </span>
            <span>
              <Clock3 /> Tandas de 10 minutos*
            </span>
            <span>
              <CalendarDays /> Fechas por consultar
            </span>
          </div>
        </div>
        <section className={cx("wrap section")} id="calendario">
          <div className={cx("section-heading")}>
            <div>
              <p className={cx("eyebrow")}>01 / ELIGE TU MOMENTO</p>
              <h2>ENCUENTRA TU PRÓXIMA FECHA.</h2>
            </div>
            <p>
              Explora el calendario y consulta las tandas.
              <br />
              Horarios de El Salvador (UTC−6).
            </p>
          </div>
          <div className={cx("calendar-layout")}>
            <div className={cx("calendar-panel")}>
              <div className={cx("month-heading")}>
                <h3>
                  {dateLabel(`${month}-01`, { month: "long", year: "numeric" })}
                </h3>
                <div>
                  <button
                    aria-label="Mes anterior"
                    className={cx("icon-button")}
                    onClick={() => changeMonth(-1)}
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    aria-label="Mes siguiente"
                    className={cx("icon-button")}
                    onClick={() => changeMonth(1)}
                  >
                    <ChevronRight />
                  </button>
                </div>
              </div>
              <div
                className={cx("calendar-grid")}
                aria-label="Calendario de fechas"
              >
                <>
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <span className={cx("weekday")} key={i} aria-hidden="true">
                      {d}
                    </span>
                  ))}
                  {Array.from({ length: offset }, (_, i) => (
                    <span key={`blank-${i}`} />
                  ))}
                  {Array.from({ length: days }, (_, i) => {
                    const value = `${month}-${String(i + 1).padStart(2, "0")}`;
                    const scheduled = catalog.events.some(
                      (e) => e.date === value,
                    );
                    return (
                      <button
                        key={value}
                        className={cx(
                          `day ${value === date ? "active" : ""} ${scheduled ? "scheduled" : ""}`,
                        )}
                        aria-label={`${dateLabel(value)}${scheduled ? ", con evento" : ", sin eventos"}`}
                        aria-pressed={date === value}
                        onClick={() => chooseDate(value)}
                      >
                        {i + 1}
                        {scheduled && <span className={cx("dot")} />}
                      </button>
                    );
                  })}
                </>
              </div>
              <p className={cx("legend")}>
                <span className={cx("dot")} /> Fecha con evento de demostración
              </p>
              <div className={cx("events-list")}>
                {monthEvents.length ? (
                  monthEvents.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      selected={event?.id === e.id}
                      onSelect={() => chooseDate(e.date)}
                    />
                  ))
                ) : (
                  <p className={cx("empty")}>
                    No hay eventos publicados este mes.
                  </p>
                )}
              </div>
            </div>
            <div className={cx("slots-panel")}>
              <div className={cx("slots-heading")}>
                <p className={cx("eyebrow")}>TANDAS DISPONIBLES</p>
                <h3>{dateLabel(date)}</h3>
                <span className={cx("muted")}>
                  {event ? event.name : "Consulta otra fecha del calendario"}
                </span>
              </div>
              <div aria-live="polite">
                {!event ? (
                  <div className={cx("empty")}>
                    <CalendarDays />
                    <h3>No hay eventos en esta fecha</h3>
                    <p>Elige uno de los días marcados para ver sus horarios.</p>
                  </div>
                ) : event.status === "closed" ? (
                  <div className={cx("empty")}>
                    <h3>Inscripciones cerradas</h3>
                    <p>
                      Consulta otra fecha para encontrar tandas disponibles.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={cx("slots-grid")}>
                      {slots.map((s) => (
                        <SlotCard
                          key={s.id}
                          slot={s}
                          selected={slotId === s.id}
                          onSelect={setSlotId}
                        />
                      ))}
                    </div>
                    {slots.length === 0 && (
                      <p className={cx("empty")}>
                        Los horarios todavía no se han publicado.
                      </p>
                    )}
                    {slots.length > 0 &&
                      slots.every((s) => s.availableSeats === 0) && (
                        <p className={cx("empty")}>
                          Todas las tandas de esta fecha están agotadas.
                        </p>
                      )}
                  </>
                )}
              </div>
              <div className={cx("selection-summary")}>
                <span className={cx("eyebrow")}>TU SELECCIÓN</span>
                <p>
                  {slot
                    ? `${timeLabel(slot.startsAt)} · ${dateLabel(date, { day: "numeric", month: "short" })}`
                    : "Selecciona una tanda para continuar"}
                </p>
                <small>
                  {pack
                    ? `Paquete ${pack.name}`
                    : "Puedes elegir tu paquete abajo o en el siguiente paso."}
                </small>
                {slot && pack && slot.availableSeats < pack.participants && (
                  <p className={cx("amber")} role="status">
                    No hay cupos suficientes para este paquete. Elige otra tanda
                    o paquete.
                  </p>
                )}
                {canContinue && event ? (
                  <Link
                    className={cx("button")}
                    href={bookingHref(event.id, slotId, packageId)}
                  >
                    Continuar a reservar <ArrowRight size={18} />
                  </Link>
                ) : (
                  <button className={cx("button")} disabled>
                    Continuar a reservar <ArrowRight size={18} />
                  </button>
                )}
                <small>Esta selección no aparta cupos.</small>
              </div>
            </div>
          </div>
        </section>
        <section id="paquetes" className={cx("packages-section")}>
          <div className={cx("wrap section")}>
            <div className={cx("section-heading")}>
              <div>
                <p className={cx("eyebrow")}>02 / A TU MANERA</p>
                <h2>MÁS VUELTAS. MÁS MOMENTOS.</h2>
              </div>
              <p>
                Compara los paquetes antes de continuar.
                <br />
                Tarifas vigentes. Segunda vuelta requiere completar la primera.
              </p>
            </div>
            <div className={cx("packages-grid")}>
              {catalog.packages
                .filter((p) => p.active)
                .map((p) => (
                  <PackageCard
                    key={p.id}
                    item={p}
                    selected={packageId === p.id}
                    onSelect={setPackageId}
                  />
                ))}
            </div>
            <p className={cx("package-help")} aria-live="polite">
              {pack ? `${pack.name} seleccionado. ` : ""}
              <a href="#calendario">
                Volver al calendario <ArrowRight size={15} />
              </a>
            </p>
          </div>
        </section>
        <section className={cx("wrap section how")}>
          <div>
            <p className={cx("eyebrow")}>ANTES DE LA BANDERA VERDE</p>
            <h2>
              ASÍ EMPIEZA
              <br />
              LA EXPERIENCIA.
            </h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Encuentra tu fecha</h3>
                <p>Consulta los eventos publicados y sus horarios.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Elige tu experiencia</h3>
                <p>Compara paquetes y continúa al proceso de reserva.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Revisa y confirma</h3>
                <p>
                  El flujo de reservas verificará disponibilidad y requisitos
                  antes de confirmar.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </main>
      <footer className={cx("wrap footer")}>
        <span className={cx("brand")}>
          PITLANE <small>KARTING RENTAL EXPERIENCE</small>
        </span>
        <p>Propuesta de interfaz · Proyecto académico ACES</p>
        <a href="#contenido">Volver arriba ↑</a>
      </footer>
    </div>
  );
}
