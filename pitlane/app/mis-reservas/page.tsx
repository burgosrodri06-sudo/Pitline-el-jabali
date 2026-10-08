import Link from "next/link";
import {
  getMyCredits,
  getMyReservations,
  operationTime,
} from "@/lib/operations/service";
import {
  EmptyState,
  money,
  OperationsShell,
  pageNumber,
  Pagination,
  styles,
} from "@/components/operations/ui";
import { ReservationCard } from "@/components/operations/reservation-card";
export default async function MyReservations({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = pageNumber((await searchParams).page);
  const [{ reservations, total }, credits] = await Promise.all([
    getMyReservations(page),
    getMyCredits(),
  ]);
  const now = await operationTime();
  const upcoming = reservations.filter(
    (r) =>
      Date.parse(r.slot.endsAt) >= now &&
      !["cancelled", "expired", "no_show"].includes(r.status),
  );
  const history = reservations.filter((r) => !upcoming.includes(r));
  return (
    <OperationsShell
      title="Mis reservas"
      description="Tus próximas vueltas, comprobantes de acceso e historial. Todos los horarios corresponden a El Salvador."
    >
      <div className={styles.fields}>
        <Link
          className={styles.button}
          href="/karting/kartingrentalexperience/reservar"
        >
          Reservar una tanda
        </Link>
      </div>
      {credits.length > 0 && (
        <section className={styles.card}>
          <h2>Créditos a tu favor</h2>
          <p className={styles.metric}>
            {money(
              credits
                .filter((c) => !c.usedReservationId)
                .reduce((n, c) => n + c.amount, 0),
            )}
          </p>
          <p className={styles.muted}>
            No vencen. Contacta al personal para coordinar tu reprogramación.
          </p>
          <ul className={styles.list}>
            {credits.map((c) => (
              <li key={c.id}>
                {money(c.amount)} · {c.reason}{" "}
                <span className={styles.muted}>
                  {c.usedReservationId ? "· Utilizado" : "· Disponible"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2 className={styles.section}>Próximas reservas</h2>
      {upcoming.length ? (
        <div className={styles.grid}>
          {upcoming.map((r) => (
            <ReservationCard key={r.id} reservation={r} />
          ))}
        </div>
      ) : (
        <EmptyState>No hay próximas reservas en esta página.</EmptyState>
      )}
      <h2 className={styles.section}>Historial</h2>
      {history.length ? (
        <div className={styles.grid}>
          {history.map((r) => (
            <ReservationCard key={r.id} reservation={r} />
          ))}
        </div>
      ) : (
        <EmptyState>
          Aquí verás tus reservas anteriores y cancelaciones.
        </EmptyState>
      )}
      <Pagination page={page} total={total} href="/mis-reservas" />
    </OperationsShell>
  );
}
