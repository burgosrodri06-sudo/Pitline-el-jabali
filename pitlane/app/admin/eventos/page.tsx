import { requireAdmin } from "@/lib/auth";
import { getAdminEvents } from "@/services/events.service";
import { getEventSlots } from "@/services/slots.service";
import {
  localToday,
  timeInSalvador,
  type EventRow,
} from "@/domain/events/inventory";
import { InventoryShell } from "@/components/kre/InventoryShell";
import { InventoryForm } from "@/components/kre/InventoryForm";
export const dynamic = "force-dynamic";
export const metadata = { title: 'Fechas y tandas | PitLane' };
const labels = {
  draft: "Borrador",
  open: "Publicada",
  closed: "Cerrada",
  cancelled: "Cancelada",
};
function EventFields({ event }: { event?: EventRow }) {
  return (
    <>
      <input type="hidden" name="operation" value="event" />
      <input type="hidden" name="id" value={event?.id ?? ""} />
      <input type="hidden" name="status" value={event?.status ?? "draft"} />
      <label>
        Fecha
        <input
          required
          type="date"
          name="date"
          min={localToday()}
          defaultValue={event?.date}
        />
      </label>
      <label>
        Inicio
        <input
          required
          type="time"
          name="start_time"
          defaultValue={event?.start_time.slice(0, 5) ?? "18:00"}
        />
      </label>
      <label>
        Fin · 00:00 = medianoche
        <input
          required
          type="time"
          name="end_time"
          defaultValue={event?.end_time.slice(0, 5) ?? "00:00"}
        />
      </label>
      <label>
        Buffer entre tandas (min)
        <input
          required
          type="number"
          name="buffer_minutes"
          min="0"
          max="60"
          defaultValue={event?.buffer_minutes ?? 0}
        />
      </label>
    </>
  );
}
export default async function EventsPage() {
  await requireAdmin();
  const events = await getAdminEvents();
  const slots = await Promise.all(events.map((e) => getEventSlots(e.id)));
  return (
    <InventoryShell admin>
      <p className="eyebrow">CONTROL KRE</p>
      <h1>Fechas y tandas</h1>
      <p>
        Organiza la pista, genera tandas de 10 minutos y publica las fechas del
        calendario. Horarios de El Salvador.
      </p>
      <div className="stats">
        <div>
          <b>{events.length}</b>fechas
        </div>
        <div>
          <b>{events.filter((e) => e.status === "open").length}</b>publicadas
        </div>
        <div>
          <b>{slots.flat().length}</b>tandas
        </div>
      </div>
      <section>
        <h2>Crear fecha KRE</h2>
        <p>
          Se guarda como borrador. La capacidad debe corresponder a los karts
          disponibles, hasta 10.
        </p>
        <InventoryForm label="Crear borrador">
          <EventFields />
        </InventoryForm>
      </section>
      {!events.length && (
        <p className="empty">
          Aún no hay fechas. Crea la primera para comenzar.
        </p>
      )}
      {events.map((event, index) => (
        <section key={event.id}>
          <span className="badge">{labels[event.status]}</span>
          <h2>
            {event.date} · {event.start_time.slice(0, 5)} —{" "}
            {event.end_time.slice(0, 5)}
          </h2>
          <details>
            <summary>Editar fecha y horario</summary>
            <p>
              Si ya generaste tandas, el horario queda protegido. Puedes editar
              las tandas individualmente dentro de ese horario.
            </p>
            <InventoryForm>
              <EventFields event={event} />
            </InventoryForm>
          </details>
          <InventoryForm
            label="Actualizar estado"
            confirmation="Cerrar o cancelar también afecta a las tandas. Las reservas y los pagos se conservan para que Operación gestione los casos pendientes. ¿Continuar?"
          >
            <input type="hidden" name="operation" value="event-status" />
            <input type="hidden" name="id" value={event.id} />
            <label>
              Estado
              <select name="status" defaultValue={event.status}>
                {Object.entries(labels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </InventoryForm>
          {slots[index].length === 0 ? (
            <InventoryForm label="Generar tandas">
              <input type="hidden" name="operation" value="generate" />
              <input type="hidden" name="id" value={event.id} />
              <label>
                Karts disponibles / capacidad
                <input
                  name="capacity"
                  type="number"
                  min="1"
                  max="10"
                  defaultValue="10"
                  required
                />
              </label>
              <label>
                Cupos por tanda para venta en pista
                <input
                  name="track_reserved_spots"
                  type="number"
                  min="0"
                  max="10"
                  defaultValue="0"
                  required
                />
              </label>
            </InventoryForm>
          ) : (
            <details>
              <summary>{slots[index].length} tandas · ver y editar</summary>
              {slots[index].map((slot) => (
                <article key={slot.id}>
                  <h3>
                    {timeInSalvador(slot.starts_at)} —{" "}
                    {timeInSalvador(slot.ends_at)}{" "}
                    <span className="badge">
                      {slot.available_spots} cupos web
                    </span>
                  </h3>
                  <InventoryForm confirmation="¿Guardar los cambios de esta tanda? Las reservas existentes se conservarán.">
                    <input type="hidden" name="operation" value="slot" />
                    <input type="hidden" name="id" value={slot.id} />
                    <label>
                      Inicio (El Salvador)
                      <input
                        type="datetime-local"
                        name="starts_at"
                        required
                        defaultValue={new Date(
                          Date.parse(slot.starts_at) - 21600000,
                        )
                          .toISOString()
                          .slice(0, 16)}
                      />
                    </label>
                    <label>
                      Capacidad
                      <input
                        type="number"
                        name="capacity"
                        min="1"
                        max="10"
                        defaultValue={slot.capacity}
                        required
                      />
                    </label>
                    <label>
                      Cupos para pista
                      <input
                        type="number"
                        name="track_reserved_spots"
                        min="0"
                        max="10"
                        defaultValue={slot.track_reserved_spots}
                        required
                      />
                    </label>
                    <label>
                      Estado
                      <select name="status" defaultValue={slot.status}>
                        <option value="available">Disponible</option>
                        <option value="full">Llena</option>
                        <option value="closed">Cerrada</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                    </label>
                  </InventoryForm>
                </article>
              ))}
            </details>
          )}
        </section>
      ))}
    </InventoryShell>
  );
}
