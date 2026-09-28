"use client";
import { cx } from "./styles";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Flag,
  CalendarDays,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "./Icons";
import type { Catalog } from "@/domain/events/types";
import {
  bookingHref,
  dateLabel,
  INITIAL_MONTH,
  money,
  timeLabel,
} from "@/lib/catalog";
import { EventCard } from "./EventCard";
import { SlotCard } from "./SlotCard";
import { PackageCard } from "./PackageCard";
const TRACK =
  "M100 390 L100 160 Q100 95 170 95 L350 95 Q415 95 415 160 L415 205 Q415 245 365 245 L270 245 Q230 245 230 285 L230 320 Q230 350 280 350 L365 350 Q420 350 420 400 Q420 450 355 450 L155 450 Q100 450 100 390Z";
export function KreExperience({ catalog }: { catalog: Catalog }) {
  const [month, setMonth] = useState(INITIAL_MONTH);
  const [date, setDate] = useState(
    catalog.events[0]?.date ?? `${INITIAL_MONTH}-01`,
  );
  const [slotId, setSlotId] = useState<string>();
  const [packageId, setPackageId] = useState<string>();
  const [notice, setNotice] = useState("");
  const event = catalog.events.find((e) => e.date === date);
  const slots = catalog.slots.filter((s) => s.eventId === event?.id);
  const slot = slots.find((s) => s.id === slotId);
  const activePackages = catalog.packages.filter((p) => p.active);
  const pack = activePackages.find((p) => p.id === packageId);
  const [year, mon] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7;
  const monthEvents = catalog.events.filter((e) => e.date.startsWith(month));
  const fromPrice = Math.min(...activePackages.map((p) => p.priceCents));
  const capacity = catalog.slots[0]?.capacity;
  const openSlots = slots.filter(
    (s) => s.status === "open" && s.availableSeats > 0,
  );
  function chooseDate(value: string) {
    setDate(value);
    setSlotId(undefined);
    setNotice("");
  }
  function chooseSlot(id: string) {
    setSlotId(id);
    const next = slots.find((s) => s.id === id);
    if (pack && next && next.availableSeats < pack.participants) {
      setPackageId(undefined);
      setNotice(
        `${pack.name} necesita ${pack.participants} karts y esta tanda tiene ${next.availableSeats}. Elige otro paquete.`,
      );
    } else {
      setNotice("");
    }
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
    !!pack &&
    slot.availableSeats >= pack.participants;
  const missing = !slot
    ? "Elige una tanda para continuar."
    : !pack
      ? "Elige un paquete para continuar."
      : "";
  return (
    <div lang="es-SV" className={cx("root")} data-styleseed-recipe="commerce-operator">
      <a className={cx("skip-link")} href="#contenido">
        Saltar al contenido
      </a>
      <div className={cx("demo-banner")}>
        Prototipo · Fechas, cupos y tarifas de ejemplo. No se realizan reservas.
      </div>
      <header className={cx("navbar wrap")}>
        <Link href="/karting/kartingrentalexperience" className={cx("brand")}>
          <Flag size={20} aria-hidden="true" />
          <span>
            Pitlane<small>El Jabalí · Karting</small>
          </span>
        </Link>
        <nav aria-label="Navegación principal">
          <a href="#reservar">Reservar</a>
          <a href="#como-funciona">Cómo funciona</a>
        </nav>
      </header>
      <main id="contenido">
        <section className={cx("identity wrap")} aria-labelledby="titulo">
          <div className={cx("identity-copy")}>
            <p className={cx("eyebrow")}>Karting Rental Experience</p>
            <h1 id="titulo">Tandas nocturnas en El Jabalí</h1>
            <p className={cx("lede")}>
              Elige fecha, tanda y paquete. Tu kart, la pista de noche y diez
              minutos para compartir con tu grupo.
            </p>
            <dl className={cx("facts")}>
              <div>
                <dt>Desde</dt>
                <dd className={cx("num")}>{money(fromPrice)}</dd>
              </div>
              <div>
                <dt>Tanda</dt>
                <dd className={cx("num")}>
                  {catalog.packages[0]?.minutesPerSession ?? 10} min
                </dd>
              </div>
              <div>
                <dt>Karts por tanda</dt>
                <dd className={cx("num")}>{capacity}</dd>
              </div>
              <div>
                <dt>Horario</dt>
                <dd className={cx("num")}>UTC−6</dd>
              </div>
            </dl>
            <p className={cx("location")}>
              <MapPin size={16} /> Autódromo Internacional El Jabalí
            </p>
          </div>
          <figure className={cx("track")}>
            <svg viewBox="40 40 440 460" aria-hidden="true">
              <path d={TRACK} className={cx("track-asphalt")} />
              <path d={TRACK} className={cx("track-center")} />
              <path
                d="M100 350 L100 160 Q100 95 170 95 L280 95"
                className={cx("track-lap")}
              />
              <circle cx="280" cy="95" r="10" className={cx("track-kart")} />
            </svg>
            <figcaption>Ilustración conceptual · no es el trazado real</figcaption>
          </figure>
        </section>
        <section
          id="reservar"
          className={cx("booking wrap")}
          aria-labelledby="reservar-titulo"
        >
          <h2 id="reservar-titulo" className={cx("sr-only")}>
            Reservar una tanda
          </h2>
          <div className={cx("steps")}>
            <div className={cx("step step-date")}>
              <div className={cx("step-head")}>
                <span className={cx("step-no")}>01</span>
                <h3>Fecha</h3>
              </div>
              <div className={cx("month-heading")}>
                <p className={cx("month-name")}>
                  {dateLabel(`${month}-01`, { month: "long", year: "numeric" })}
                </p>
                <div>
                  <button
                    type="button"
                    aria-label="Mes anterior"
                    className={cx("icon-button")}
                    onClick={() => changeMonth(-1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="Mes siguiente"
                    className={cx("icon-button")}
                    onClick={() => changeMonth(1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
              <div
                className={cx("calendar-grid")}
                role="group"
                aria-label="Calendario de fechas"
              >
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
                      type="button"
                      key={value}
                      className={cx(
                        `day ${value === date ? "active" : ""} ${scheduled ? "scheduled" : ""}`,
                      )}
                      aria-label={`${dateLabel(value)}${scheduled ? ", con evento" : ", sin eventos"}`}
                      aria-pressed={date === value}
                      onClick={() => chooseDate(value)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className={cx("rows")}>
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
                    No hay fechas publicadas este mes. Prueba el mes siguiente.
                  </p>
                )}
              </div>
            </div>
            <div className={cx("step step-slot")}>
              <div className={cx("step-head")}>
                <span className={cx("step-no")}>02</span>
                <h3>Tanda</h3>
                <span className={cx("step-context")}>{dateLabel(date)}</span>
              </div>
              <div aria-live="polite">
                {!event ? (
                  <div className={cx("empty")}>
                    <CalendarDays size={20} />
                    <p>
                      No hay tandas este día. Elige una fecha resaltada en el
                      calendario.
                    </p>
                  </div>
                ) : event.status === "closed" ? (
                  <p className={cx("empty")}>
                    Inscripciones cerradas. Consulta otra fecha.
                  </p>
                ) : slots.length === 0 ? (
                  <p className={cx("empty")}>
                    Los horarios de esta fecha todavía no se han publicado.
                  </p>
                ) : (
                  <>
                    <p className={cx("sheet-meta")}>
                      <span className={cx("num")}>{openSlots.length}</span> de{" "}
                      <span className={cx("num")}>{slots.length}</span> tandas
                      con karts libres
                    </p>
                    <div className={cx("rows sheet")}>
                      {slots.map((s) => (
                        <SlotCard
                          key={s.id}
                          slot={s}
                          selected={slotId === s.id}
                          onSelect={chooseSlot}
                        />
                      ))}
                    </div>
                    {openSlots.length === 0 && (
                      <p className={cx("empty")}>
                        Todas las tandas de esta fecha están agotadas. Elige
                        otra fecha.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className={cx("step step-package")}>
              <div className={cx("step-head")}>
                <span className={cx("step-no")}>03</span>
                <h3>Paquete</h3>
                <span className={cx("step-context")}>
                  Precios pendientes de validación
                </span>
              </div>
              <div className={cx("rows")}>
                {activePackages.map((p) => (
                  <PackageCard
                    key={p.id}
                    item={p}
                    selected={packageId === p.id}
                    seatsLeft={slot?.availableSeats}
                    onSelect={(id) => {
                      setPackageId(id);
                      setNotice("");
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <aside className={cx("summary")} aria-labelledby="resumen-titulo">
            <h3 id="resumen-titulo" className={cx("eyebrow")}>
              Tu selección
            </h3>
            <dl>
              <div>
                <dt>Fecha</dt>
                <dd>
                  {event
                    ? dateLabel(date, { weekday: "long", day: "numeric", month: "short" })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Tanda</dt>
                <dd className={cx("num")}>
                  {slot ? timeLabel(slot.startsAt) : "—"}
                </dd>
              </div>
              <div>
                <dt>Paquete</dt>
                <dd>{pack ? pack.name : "—"}</dd>
              </div>
              <div className={cx("total")}>
                <dt>Total</dt>
                <dd className={cx("num")}>
                  {pack ? money(pack.priceCents) : "—"}
                </dd>
              </div>
            </dl>
            <p className={cx("notice")} role="status">
              {notice}
            </p>
            {canContinue && event ? (
              <Link
                className={cx("button")}
                href={bookingHref(event.id, slotId, packageId)}
              >
                Continuar a reservar <ArrowRight size={18} />
              </Link>
            ) : (
              <button
                type="button"
                className={cx("button")}
                disabled
                aria-describedby="falta"
              >
                Continuar a reservar <ArrowRight size={18} />
              </button>
            )}
            <p id="falta" className={cx("summary-help")}>
              {missing || "Revisarás los datos antes de confirmar."} Esta
              selección no aparta cupos.
            </p>
          </aside>
        </section>
        <section
          id="como-funciona"
          className={cx("how wrap")}
          aria-labelledby="como-titulo"
        >
          <h2 id="como-titulo">Antes de la bandera verde</h2>
          <ol>
            <li>
              <h3>Horario de El Salvador</h3>
              <p>Todas las tandas se muestran en hora local (UTC−6).</p>
            </li>
            <li>
              <h3>Sin cargos ocultos</h3>
              <p>El total que ves en tu selección es el que revisarás al reservar.</p>
            </li>
            <li>
              <h3>Confirmación verificada</h3>
              <p>
                El flujo de reserva verifica disponibilidad y requisitos antes
                de confirmar.
              </p>
            </li>
          </ol>
        </section>
      </main>
      <footer className={cx("wrap footer")}>
        <span className={cx("brand")}>
          Pitlane <small>Karting Rental Experience</small>
        </span>
        <p>Propuesta de interfaz · Proyecto académico ACES</p>
        <a href="#contenido">Volver arriba ↑</a>
      </footer>
    </div>
  );
}
