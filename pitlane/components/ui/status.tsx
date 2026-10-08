import type { ComponentType, ReactNode, SVGProps } from "react";
import { cx } from "./cx";
import { AlertTriangle, Check, CheckCircle, Hourglass, Info, XCircle } from "./icons";

// Mapa presentacional único de estados. Los valores internos (snake_case) no cambian.
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";
type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const states: Record<string, { label: string; tone: Tone; icon?: Icon }> = {
  pending_payment: { label: "Pendiente de pago", tone: "warning", icon: Hourglass },
  payment_review: { label: "En revisión", tone: "info", icon: Hourglass },
  paid: { label: "Pagada", tone: "success", icon: CheckCircle },
  cancelled: { label: "Cancelada", tone: "neutral", icon: XCircle },
  expired: { label: "Expirada", tone: "neutral", icon: XCircle },
  attended: { label: "Con asistencia", tone: "success", icon: Check },
  no_show: { label: "No asistió", tone: "danger", icon: XCircle },
  pending: { label: "Pendiente", tone: "warning", icon: Hourglass },
  uploaded: { label: "Por revisar", tone: "info", icon: Hourglass },
  approved: { label: "Aprobado", tone: "success", icon: CheckCircle },
  rejected: { label: "Rechazado", tone: "danger", icon: XCircle },
  reconciled: { label: "Conciliado", tone: "success", icon: CheckCircle },
  available: { label: "Disponible", tone: "success" },
  full: { label: "Completa", tone: "warning", icon: AlertTriangle },
  closed: { label: "Cerrada", tone: "neutral" },
  bank_transfer: { label: "Transferencia", tone: "neutral" },
  track_cash: { label: "Efectivo en pista", tone: "neutral" },
  credit: { label: "Crédito", tone: "neutral", icon: Info },
};

export const statusLabel = (status: string) => states[status]?.label ?? status;

export const toneClass: Record<Tone, string> = {
  neutral: "border-line-strong bg-[var(--pl-neutral-soft)] text-muted",
  success: "border-success/40 bg-[var(--pl-success-soft)] text-success",
  warning: "border-warning/40 bg-[var(--pl-warning-soft)] text-warning",
  danger: "border-danger/40 bg-[var(--pl-danger-soft)] text-danger",
  info: "border-info/40 bg-[var(--pl-info-soft)] text-info",
  brand: "border-brand/50 bg-[var(--pl-red-soft)] text-brand-text",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--pl-radius-sm)] border px-2 py-0.5 text-xs font-semibold tracking-wide",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const state = states[status];
  const Icon = state?.icon;
  return (
    <Badge tone={state?.tone} className={className}>
      {Icon && <Icon size={14} />}
      {state?.label ?? status}
    </Badge>
  );
}
