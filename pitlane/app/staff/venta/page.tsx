import { randomUUID } from "node:crypto";
export const metadata = { title: 'Venta en pista · PitLane' };
import { requireRole } from "@/lib/auth";
import {
  getOperationSlots,
  getPackages,
  getReservationAccess,
  getSecondRideCandidates,
  getTrackAvailability,
  localToday,
  operationTime,
} from "@/lib/operations/service";
import {
  EmptyState,
  OperationsShell,
  styles,
  time,
} from "@/components/operations/ui";
import { TrackSaleForm } from "@/components/operations/track-sale-form";
import { ReservationCard } from "@/components/operations/reservation-card";
export default async function TrackSales({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; ticket?: string }>;
}) {
  const { profile } = await requireRole("staff", "kre_admin", "system_admin");
  const query = await searchParams;
  const date = localToday();
  const [allSlots, allPackages, candidates] = await Promise.all([
    getOperationSlots(date),
    getPackages(),
    getSecondRideCandidates(date),
  ]);
  const now = await operationTime();
  const slots = allSlots.filter(
    (s) =>
      Date.parse(s.startsAt) > now &&
      ["available", "full"].includes(s.status) &&
      s.eventStatus === "open" &&
      !s.closed,
  );
  const slot = slots.find((s) => s.id === query.slot) ?? slots[0];
  const available = slot ? await getTrackAvailability(slot.id) : 0;
  const packages = allPackages.filter(
    (p) =>
      p.active &&
      p.spots === 1 &&
      (!p.validFrom || p.validFrom <= date) &&
      (!p.validTo || p.validTo >= date),
  );
  const ticket = query.ticket
    ? await getReservationAccess(query.ticket, false)
    : null;
  return (
    <OperationsShell
      role={profile.role}
      title="Venta en pista"
      description="Registra el efectivo recibido para Individual o Segunda vuelta. La disponibilidad se verifica otra vez al confirmar la venta."
    >
      {ticket && (
        <section>
          <h2 className={styles.section}>Comprobante de venta</h2>
          <div className={styles.grid}>
            <ReservationCard reservation={ticket} track />
          </div>
        </section>
      )}
      <form className={styles.fields}>
        <label className={styles.label}>
          Tandas de hoy
          <select className={styles.input} name="slot" defaultValue={slot?.id}>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {time(s.startsAt)} – {time(s.endsAt)}
              </option>
            ))}
          </select>
        </label>
        <button className={styles.button}>Actualizar cupos</button>
      </form>
      {!slot ? (
        <EmptyState>
          No hay tandas próximas disponibles para venta hoy.
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          <section className={styles.card}>
            <h2>
              {time(slot.startsAt)} – {time(slot.endsAt)}
            </h2>
            <p className={styles.metric}>{available} cupos</p>
            <p className={styles.muted}>
              Incluye los cupos reservados para pista. La venta queda pagada y
              no entra a revisión bancaria.
            </p>
          </section>
          <section className={styles.card}>
            <h2>Nueva venta</h2>
            {available > 0 && packages.length ? (
              <TrackSaleForm
                key={`${slot.id}:${query.ticket ?? "new"}`}
                slotId={slot.id}
                packages={packages}
                candidates={candidates}
                requestId={randomUUID()}
              />
            ) : (
              <EmptyState>
                {available
                  ? "No hay paquetes vigentes de un participante."
                  : "La tanda está completa. Selecciona otro horario."}
              </EmptyState>
            )}
          </section>
        </div>
      )}
    </OperationsShell>
  );
}
