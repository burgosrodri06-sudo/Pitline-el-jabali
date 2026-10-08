import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getPaymentsForReview } from "@/lib/operations/service";
import { paymentAction } from "@/app/operations-actions";
import { ActionForm } from "@/components/operations/action-form";
import {
  dateTime,
  EmptyState,
  money,
  OperationsShell,
  pageNumber,
  Pagination,
  StatusBadge,
  styles,
} from "@/components/operations/ui";
export default async function PaymentReview({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { profile } = await requireRole("payments", "system_admin");
  const query = await searchParams;
  const page = pageNumber(query.page);
  const status =
    query.status === "approved" ||
    query.status === "reconciled" ||
    query.status === "rejected"
      ? query.status
      : "uploaded";
  const { payments, total } = await getPaymentsForReview(page, status);
  return (
    <OperationsShell
      role={profile.role}
      title="Verificación de pagos"
      description="Revisa la transferencia y su comprobante antes de habilitar el acceso a pista. Las ventas en efectivo se registran por separado."
    >
      <nav className={styles.fields} aria-label="Estado de pagos">
        {[
          ["uploaded", "Por revisar"],
          ["approved", "Aprobados"],
          ["reconciled", "Conciliados"],
          ["rejected", "Rechazados"],
        ].map(([value, label]) => (
          <Link
            key={value}
            aria-current={status === value ? "page" : undefined}
            className={status === value ? styles.button : styles.link}
            href={`?status=${value}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!payments.length && (
        <EmptyState>No hay transferencias en este estado.</EmptyState>
      )}
      <div className={styles.stack}>
        {payments.map((p) => (
          <article className={styles.card} key={p.id}>
            <div className={styles.row}>
              <h2>
                {p.reservation.code} · {p.reservation.holderName}
              </h2>
              <StatusBadge status={p.status} />
            </div>
            <dl className={styles.details}>
              <dt>Tanda</dt>
              <dd>{dateTime(p.reservation.slot.startsAt)}</dd>
              <dt>Paquete</dt>
              <dd>{p.reservation.packageName}</dd>
              <dt>Monto presentado / reserva</dt>
              <dd>
                {money(p.amount)} / {money(p.reservation.amount)}
              </dd>
              <dt>Referencia bancaria</dt>
              <dd>{p.reference ?? "No registrada"}</dd>
              <dt>Últimos cuatro dígitos</dt>
              <dd>{p.last4 ?? "No registrados"}</dd>
              <dt>Recibido</dt>
              <dd>{dateTime(p.createdAt)}</dd>
            </dl>
            {p.receiptPath ? (
              <a
                className={styles.link}
                href={`/cobros/verificacion/${p.id}/comprobante`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir comprobante privado
              </a>
            ) : (
              <p className={styles.error}>No hay comprobante adjunto.</p>
            )}
            {p.rejectionReason && (
              <p className={styles.error}>{p.rejectionReason}</p>
            )}
            {p.status === "uploaded" && (
              <div className={styles.grid} style={{ marginTop: 20 }}>
                <ActionForm
                  action={paymentAction}
                  label="Aprobar pago"
                  confirm="¿Verificaste el comprobante y el monto? Esta aprobación habilita el QR."
                >
                  <input type="hidden" name="paymentId" value={p.id} />
                  <input type="hidden" name="decision" value="approve" />
                </ActionForm>
                <ActionForm action={paymentAction} label="Rechazar pago">
                  <input type="hidden" name="paymentId" value={p.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <label className={styles.label}>
                    Motivo de rechazo
                    <textarea
                      className={styles.input}
                      name="reason"
                      required
                      maxLength={1000}
                    />
                  </label>
                </ActionForm>
              </div>
            )}
            {p.status === "approved" && (
              <div style={{ marginTop: 20 }}>
                <ActionForm
                  action={paymentAction}
                  label="Marcar conciliado"
                  confirm="¿Confirmas que el ingreso aparece en el movimiento bancario?"
                >
                  <input type="hidden" name="paymentId" value={p.id} />
                  <input type="hidden" name="decision" value="reconcile" />
                </ActionForm>
              </div>
            )}
          </article>
        ))}
      </div>
      <Pagination
        page={page}
        total={total}
        href={`/cobros/verificacion?status=${status}`}
      />
    </OperationsShell>
  );
}
