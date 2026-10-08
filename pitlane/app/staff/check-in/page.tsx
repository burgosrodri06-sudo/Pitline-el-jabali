import { requireRole } from "@/lib/auth";
export const metadata = { title: 'Control de pista · PitLane' };
import {
  getOperationSlots,
  getSlotAttendance,
  localToday,
  operationTime,
} from "@/lib/operations/service";
import {
  checkInAction,
  closeSlotAction,
  completeRideAction,
  creditAction,
} from "@/app/operations-actions";
import { ActionForm } from "@/components/operations/action-form";
import { ScanInput } from "@/components/operations/scan-input";
import {
  dateTime,
  EmptyState,
  OperationsShell,
  StatusBadge,
  statusLabel,
  styles,
  time,
} from "@/components/operations/ui";
export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; slot?: string; q?: string }>;
}) {
  const { profile } = await requireRole("staff", "kre_admin", "system_admin");
  const query = await searchParams;
  const date = query.date || localToday();
  const slots = await getOperationSlots(date);
  const slot = slots.find((s) => s.id === query.slot) ?? slots[0];
  const reservations = slot ? await getSlotAttendance(slot.id) : [];
  const needle = (query.q ?? "").trim().toLocaleLowerCase("es");
  const filtered = reservations.filter(
    (r) =>
      !needle ||
      r.code.toLowerCase().includes(needle) ||
      r.participants.some((p) =>
        p.fullName.toLocaleLowerCase("es").includes(needle),
      ),
  );
  const present = reservations
    .flatMap((r) => r.participants)
    .filter((p) => p.attendance?.checkedInAt).length;
  const now = await operationTime();
  const finished = slot && Date.parse(slot.endsAt) <= now;
  return (
    <OperationsShell
      role={profile.role}
      title="Control de pista"
      description="Selecciona la tanda, verifica el acceso y registra a cada participante. Completar la primera vuelta es una acción distinta del check-in."
    >
      <form className={styles.fields}>
        <label className={styles.label}>
          Fecha
          <input
            className={styles.input}
            type="date"
            name="date"
            defaultValue={date}
            required
          />
        </label>
        <label className={styles.label}>
          Tanda
          <select className={styles.input} name="slot" defaultValue={slot?.id}>
            <option value="">Primera tanda de la fecha</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {time(s.startsAt)} — {statusLabel(s.status)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Buscar nombre o código
          <input
            className={styles.input}
            name="q"
            maxLength={120}
            defaultValue={query.q}
            placeholder="Nombre del participante / KRE-…"
          />
        </label>
        <button className={styles.button}>Consultar</button>
      </form>
      {!slot ? (
        <EmptyState>No hay tandas para esta fecha.</EmptyState>
      ) : (
        <>
          <div className={styles.grid}>
            <section className={styles.card}>
              <div className={styles.row}>
                <h2>{dateTime(slot.startsAt)}</h2>
                <StatusBadge status={slot.status} />
              </div>
              <p className={styles.metric}>
                {present} / {slot.capacity}
              </p>
              <p className={styles.muted}>
                Participantes con check-in ·{" "}
                {slot.closed ? "Asistencia cerrada" : "Asistencia abierta"}
              </p>
            </section>
            <section className={styles.card}>
              <h2>Registrar llegada</h2>
              {slot.closed || finished || slot.status === "cancelled" ? (
                <p className={styles.muted}>
                  Esta tanda ya no acepta check-in.
                </p>
              ) : (
                <ActionForm
                  action={checkInAction}
                  label="Registrar grupo completo"
                  confirm="¿Están presentes todos los participantes de esta reserva? Para entradas parciales usa la lista de participantes."
                >
                  <input type="hidden" name="slotId" value={slot.id} />
                  <ScanInput />
                </ActionForm>
              )}
            </section>
          </div>
          <h2 className={styles.section}>Participantes</h2>
          {!filtered.length && (
            <EmptyState>
              {needle
                ? "No hay coincidencias en esta tanda."
                : "No hay reservas pagadas para esta tanda."}
            </EmptyState>
          )}
          <div className={styles.stack}>
            {filtered.map((r) => (
              <article key={r.id} className={styles.card}>
                <div className={styles.row}>
                  <h2>
                    {r.code} · {r.packageName}
                  </h2>
                  <StatusBadge status={r.status} />
                </div>
                <ul className={styles.list}>
                  {r.participants.map((p) => (
                    <li key={p.id} className={styles.participant}>
                      <div className={styles.row}>
                        <div>
                          <strong>{p.fullName}</strong>
                          <p className={styles.muted}>
                            {p.attendance?.noShow
                              ? "Ausencia registrada"
                              : p.attendance?.checkedInAt
                                ? `Ingresó ${time(p.attendance.checkedInAt)}`
                                : "Pendiente de llegada"}
                            {p.attendance?.firstRideCompleted &&
                              " · Primera vuelta completada"}
                          </p>
                        </div>
                        {!p.attendance?.checkedInAt &&
                          !p.attendance?.noShow &&
                          !slot.closed &&
                          !finished &&
                          slot.status !== "cancelled" && (
                            <ActionForm
                              action={checkInAction}
                              label="Marcar llegada"
                            >
                              <input
                                type="hidden"
                                name="slotId"
                                value={slot.id}
                              />
                              <input
                                type="hidden"
                                name="lookup"
                                value={r.code}
                              />
                              <input
                                type="hidden"
                                name="participantId"
                                value={p.id}
                              />
                            </ActionForm>
                          )}
                        {p.attendance?.checkedInAt &&
                          !p.attendance.firstRideCompleted &&
                          finished && (
                            <ActionForm
                              action={completeRideAction}
                              label="Completó su vuelta"
                              confirm={`¿Confirmas que ${p.fullName} completó la vuelta en pista?`}
                            >
                              <input
                                type="hidden"
                                name="participantId"
                                value={p.id}
                              />
                            </ActionForm>
                          )}
                      </div>
                    </li>
                  ))}
                </ul>
                {["kre_admin", "system_admin"].includes(profile.role) &&
                  r.userId && (
                    <details>
                      <summary className={styles.muted}>
                        Crédito por cancelación o incidente
                      </summary>
                      <ActionForm
                        action={creditAction}
                        label="Cancelar y emitir crédito"
                      >
                        <input
                          type="hidden"
                          name="reservationId"
                          value={r.id}
                        />
                        <label className={styles.label}>
                          Motivo
                          <textarea
                            className={styles.input}
                            name="reason"
                            required
                            maxLength={1000}
                          />
                        </label>
                        <label className={styles.check}>
                          <input
                            type="checkbox"
                            name="confirm"
                            value="yes"
                            required
                          />
                          Confirmo la cancelación y el crédito por el saldo
                          realmente pagado.
                        </label>
                      </ActionForm>
                    </details>
                  )}
              </article>
            ))}
          </div>
          {!slot.closed && (
            <section className={styles.card} style={{ marginTop: 24 }}>
              <h2>Cierre de asistencia</h2>
              <p className={styles.muted}>
                Al terminar la tanda, registra como ausentes a quienes no
                ingresaron. Las llegadas ya registradas se conservan.
              </p>
              {finished ? (
                <ActionForm
                  action={closeSlotAction}
                  label="Cerrar tanda y marcar ausencias"
                  confirm="¿Cerrar la asistencia de esta tanda? Ya no se podrán registrar llegadas."
                >
                  <input type="hidden" name="slotId" value={slot.id} />
                </ActionForm>
              ) : (
                <p className={styles.muted}>
                  Disponible después de las {time(slot.endsAt)}.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </OperationsShell>
  );
}
