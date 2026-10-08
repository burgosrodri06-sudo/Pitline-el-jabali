import Link from "next/link";
import { getPublishedEvents } from "@/services/events.service";
import { getEventSlots } from "@/services/slots.service";
import { getPackages } from "@/services/packages.service";
import { localToday, timeInSalvador } from "@/domain/events/inventory";
import { InventoryShell } from "@/components/kre/InventoryShell";
import { RefreshAvailability } from "@/components/kre/RefreshAvailability";
import { bookingHref } from '@/lib/catalog';
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Calendario KRE | PitLane",
  description:
    "Fechas publicadas y disponibilidad real de Karting Rental Experience.",
};
export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha } = await searchParams;
  const events = await getPublishedEvents();
  const selectedDate = events.some((e) => e.date === fecha)
    ? fecha
    : events[0]?.date;
  const selected = events.filter((e) => e.date === selectedDate);
  const [slots, packages] = await Promise.all([
    Promise.all(selected.map((e) => getEventSlots(e.id))),
    getPackages(false, selectedDate ?? localToday()),
  ]);
  return (
    <InventoryShell>
      <p className="eyebrow">KARTING RENTAL EXPERIENCE</p>
      <h1>Elige tu próxima vuelta.</h1>
      <p>
        Consulta las fechas publicadas y selecciona una tanda. Horarios de El
        Salvador; cada vuelta dura 10 minutos.
      </p>
      <RefreshAvailability />
      <nav aria-label="Fechas publicadas">
        {[...new Set(events.map((e) => e.date))].map((date) => (
          <Link
            className={date === selectedDate ? "cta" : "badge"}
            aria-current={date === selectedDate ? "date" : undefined}
            key={date}
            href={"?fecha=" + date}
          >
            {new Intl.DateTimeFormat("es-SV", {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: "America/El_Salvador",
            }).format(new Date(date + "T12:00:00-06:00"))}
          </Link>
        ))}
      </nav>
      {!events.length && (
        <section className="empty">
          <h2>Próximas fechas por anunciar</h2>
          <p>
            En cuanto ACES publique una fecha, aparecerá aquí con sus tandas y
            cupos disponibles.
          </p>
        </section>
      )}
      {selected.map((event, i) => (
        <section key={event.id}>
          <span className="badge">
            {event.status === "open"
              ? "Fecha publicada"
              : event.status === "closed"
                ? "Fecha cerrada"
                : "Fecha cancelada"}
          </span>
          <h2>
            {event.date} · {event.start_time.slice(0, 5)} —{" "}
            {event.end_time.slice(0, 5)}
          </h2>
          {!slots[i].length && <p>No hay tandas publicadas para esta fecha.</p>}
          <div className="slot-list">
            {slots[i].map((slot) => {
              const ended = Date.parse(slot.starts_at) <= Date.now();
              const state =
                event.status === "cancelled" || slot.status === "cancelled"
                  ? "Cancelada"
                  : event.status !== "open" || slot.status === "closed" || ended
                    ? "Cerrada"
                    : slot.status === "full" || slot.available_spots <= 0
                      ? "Llena"
                      : slot.available_spots <= 3
                        ? "Pocos cupos"
                        : "Disponible";
              const selectable = ["Disponible", "Pocos cupos"].includes(state);
              return (
                <div className="slot" key={slot.id}>
                  <strong>{timeInSalvador(slot.starts_at)}</strong>
                  <p>10 min · capacidad {slot.capacity}</p>
                  <p
                    className={
                      selectable
                        ? state === "Pocos cupos"
                          ? "low"
                          : "available"
                        : "muted"
                    }
                  >
                    {state}
                    {selectable ? " · " + slot.available_spots + " cupos" : ""}
                  </p>
                  {selectable ? (
                    <Link className="cta" href={bookingHref(event.id, slot.id)}>
                      Seleccionar tanda
                    </Link>
                  ) : (
                    <button disabled>{state}</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <h2>Paquetes para esta fecha</h2>
      <div className="grid">
        {packages.map((pack) => (
          <article key={pack.id}>
            <h3>{pack.name}</h3>
            <h2>${pack.price.toFixed(2)}</h2>
            <p>
              {pack.spots} {pack.spots === 1 ? "cupo" : "cupos"} ·{" "}
              {pack.duration_minutes} minutos
            </p>
            {pack.eligibility === "requires_first_ride" && (
              <p>Solo después de completar tu primera vuelta.</p>
            )}
          </article>
        ))}
      </div>
      {!packages.length && <p>No hay paquetes vigentes para esta fecha.</p>}
      <p>
        Los cupos se confirman al crear la reserva. Friends Combo necesita cinco
        cupos en la misma tanda.
      </p>
    </InventoryShell>
  );
}
