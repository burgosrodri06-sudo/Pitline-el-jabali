import { cx } from "./cx";
import { Check } from "./icons";
import { statusLabel } from "./status";

// Progreso del piloto derivado SOLO del estado real de la reserva.
const steps = ["Apartada", "Comprobante enviado", "Pago aprobado", "En pista"];
const reached: Record<string, number> = {
  pending_payment: 1, // apartada; falta enviar comprobante
  payment_review: 2, // comprobante enviado; falta la revisión
  paid: 3, // pago aprobado; falta presentarse en pista
  attended: 4,
};

export function ReservationProgress({ status }: { status: string }) {
  const done = reached[status];
  if (done === undefined) {
    // Cancelada, expirada o no asistió: no se dibuja un avance que no ocurrió.
    return <p className="text-sm text-muted">Esta reserva quedó {statusLabel(status).toLowerCase()}.</p>;
  }
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Avance de la reserva">
      {steps.map((step, index) => {
        const complete = index < done;
        const current = index === done;
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="min-w-0">
            <span
              className={cx(
                "block h-1 rounded-full transition-colors duration-[var(--pl-dur)]",
                complete ? "bg-brand" : current ? "bg-brand/40" : "bg-line",
              )}
            />
            <span
              className={cx(
                "mt-2 flex items-start gap-1 text-[11px] font-semibold uppercase leading-tight tracking-wide sm:text-xs",
                complete ? "text-ink" : current ? "text-brand-text" : "text-subtle",
              )}
            >
              {complete && <Check size={12} className="mt-px shrink-0" />}
              <span>{step}</span>
              <span className="sr-only">{complete ? " (completado)" : current ? " (siguiente)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
