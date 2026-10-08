import { requireRole } from "@/lib/auth";
import { getPackages, getReports, localToday } from "@/lib/operations/service";
import { creditAction } from "@/app/operations-actions";
import { ActionForm } from "@/components/operations/action-form";
import {
  EmptyState,
  money,
  OperationsShell,
  styles,
} from "@/components/operations/ui";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    packageId?: string;
    method?: string;
  }>;
}) {
  const { profile } = await requireRole(
    "payments",
    "kre_admin",
    "system_admin",
  );
  const query = await searchParams;
  const filters = {
    from: query.from || localToday(),
    to: query.to || localToday(),
    packageId: query.packageId || "",
    method: query.method || "",
  };
  const [{ summary, facts }, packages] = await Promise.all([
    getReports(filters),
    getPackages(),
  ]);
  const csvQuery = new URLSearchParams(filters).toString();
  const creditCandidates = facts.reservations.filter(
    (r) =>
      r.userId &&
      ["paid", "attended", "no_show", "cancelled"].includes(r.status),
  );
  const metrics = [
    ["Ocupación pagada", `${summary.occupancyPercent.toFixed(1)}%`],
    ["Participantes", summary.bookedParticipants],
    ["Asistencias", summary.checkedInParticipants],
    ["Ausencias", summary.noShowParticipants],
    ["No-show", `${summary.noShowPercent.toFixed(1)}%`],
    ["Ingresos cobrados", money(summary.revenueCents / 100)],
    ["Transferencias", money(summary.webRevenueCents / 100)],
    ["Efectivo en pista", money(summary.trackCashRevenueCents / 100)],
    ["Créditos emitidos", money(summary.creditsIssuedCents / 100)],
  ];
  return (
    <OperationsShell
      role={profile.role}
      title="Reportes de operación"
      description="Resultados por fecha operativa de El Salvador. Los créditos se muestran separados de los ingresos cobrados."
    >
      <form className={styles.fields}>
        <label className={styles.label}>
          Desde
          <input
            className={styles.input}
            type="date"
            name="from"
            defaultValue={filters.from}
            required
          />
        </label>
        <label className={styles.label}>
          Hasta
          <input
            className={styles.input}
            type="date"
            name="to"
            defaultValue={filters.to}
            required
          />
        </label>
        <label className={styles.label}>
          Paquete
          <select
            className={styles.input}
            name="packageId"
            defaultValue={filters.packageId}
          >
            <option value="">Todos</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Método
          <select
            className={styles.input}
            name="method"
            defaultValue={filters.method}
          >
            <option value="">Todos</option>
            <option value="bank_transfer">Transferencia</option>
            <option value="track_cash">Efectivo en pista</option>
          </select>
        </label>
        <button className={styles.button}>Consultar</button>
        <a
          className={styles.link}
          href={`/admin/reportes/exportar?${csvQuery}`}
          download
        >
          Descargar CSV
        </a>
      </form>
      {!facts.slots.length && (
        <EmptyState>No hay tandas en el rango seleccionado.</EmptyState>
      )}
      <div className={styles.grid}>
        {metrics.map(([label, value]) => (
          <section key={label} className={styles.card}>
            <h2>{label}</h2>
            <p className={styles.metric}>{value}</p>
          </section>
        ))}
      </div>
      <p className={styles.muted} style={{ marginTop: 20 }}>
        La ocupación usa la capacidad de todas las tandas del rango. El
        porcentaje de no-show solo incluye participantes con asistencia o
        ausencia registrada.
      </p>
      <h2 className={styles.section}>Paquetes vendidos</h2>
      <div className={`${styles.card} ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Paquete</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{summary.packagesSold[p.id] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {["kre_admin", "system_admin"].includes(profile.role) && (
        <section className={styles.card} style={{ marginTop: 24 }}>
          <h2>Crédito por cancelación o incidente</h2>
          <p className={styles.muted}>
            Selecciona una reserva del rango. Se acredita el saldo realmente
            pagado y se cancela su acceso. Los walk-ins sin cuenta no reciben
            créditos.
          </p>
          {creditCandidates.length ? (
            <ActionForm action={creditAction} label="Cancelar y emitir crédito">
              <label className={styles.label}>
                Reserva
                <select className={styles.input} name="reservationId" required>
                  <option value="">Selecciona una reserva</option>
                  {creditCandidates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                    </option>
                  ))}
                </select>
              </label>
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
                <input type="checkbox" name="confirm" value="yes" required />
                Confirmo que corresponde una cancelación por ACES o incidente y
                la emisión del crédito.
              </label>
            </ActionForm>
          ) : (
            <EmptyState>
              No hay reservas para acreditar en este rango.
            </EmptyState>
          )}
        </section>
      )}
    </OperationsShell>
  );
}
